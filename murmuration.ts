import p5 from 'p5'
import Flatbush from 'flatbush'

let neighborSlider = document.getElementById("neighbors")! as HTMLInputElement
let separationSlider = document.getElementById("separation")! as HTMLInputElement
let cohesionSlider = document.getElementById("cohesion")! as HTMLInputElement
let alignmentSlider = document.getElementById("alignment")! as HTMLInputElement

class Bird {
	pos: p5.Vector
	vel: p5.Vector
	acc: p5.Vector

	constructor(x: number, y: number) {
		this.pos = new p5.Vector(x, y)
		this.vel = new p5.Vector()
		this.acc = new p5.Vector()
	}

	coordinates(len: number): { start: p5.Vector, end: p5.Vector } {
		let direction = p5.Vector.fromAngle(this.vel.heading())
		// TODO: Is there a better way to do this?
		direction.setMag(len / 2)
		let start = this.pos.copy().sub(direction)
		let end = this.pos.copy().add(direction)
		return { start, end }
	}

	update(neighbors: Bird[], predator: p5.Vector, scale: number, width: number, height: number, overshoot: number = 0, p?: p5) {
		this.acc = new p5.Vector()

		{
			let dist = this.pos.copy().sub(predator)
			let force = dist.copy().normalize().setMag(800 / dist.mag())
			this.acc = this.acc.add(force)
			this.debugForce(p, force, "red")
		}

		// Separation: avoid colliding with neighbors.
		// For each neighbour, calculate the distance.
		// If the distance is closer than some threshold, move away in the opposite direction.
		{
			for (let boid of neighbors) {
				let dist = this.pos.copy().sub(boid.pos)
				let force = dist.copy().setMag(1 / dist.magSq() * 2000)
				this.acc = this.acc.add(force)
				// this.debugForce(p, force, "green")
			}
		}

		// Alignment: steer towards average heading.
		// This is the only input of acceleration into the system.
		{
			let averageHeading = new p5.Vector()
			for (const bird of neighbors) {
				let heading = bird.vel.copy().normalize()
				averageHeading.add(heading)
			}
			averageHeading.div(neighbors.length)

			// Create a steering force towards the average heading
			let scale = parseFloat(alignmentSlider.value)
			const force = averageHeading.setMag(10 * scale)
			this.acc = this.acc.add(force)
			// this.debugForce(p, force, "blue")
		}

		// Cohesion: steer towards center of mass of neighbors.
		{
			let centerOfMass = new p5.Vector()
			for (const bird of neighbors) {
				centerOfMass.add(bird.pos)
			}
			centerOfMass.div(neighbors.length)

			if (p) {
				p.stroke("red")
				p.fill("red")
				p.circle(centerOfMass.x, centerOfMass.y, 2)
			}

			// let scale = parseFloat(cohesionSlider.value)
			const force = centerOfMass.sub(this.pos).setMag(20 * scale)
			this.acc = this.acc.add(force)
			// this.debugForce(p, force, "red")
		}

		// Drag
		{
			let dragMag = this.vel.magSq() / 3000
			let drag = this.vel.copy().mult(-1).setMag(dragMag)
			this.acc = this.acc.add(drag)
			this.debugForce(p, drag, "cyan")
		}

		// Repelling force from edges
		const edges = [
			{
				pos: new p5.Vector(this.pos.x, -overshoot),
				clamp: (v: p5.Vector) => v.y = Math.max(0, v.y),
			}, // top
			{
				pos: new p5.Vector(this.pos.x, height + overshoot),
				clamp: (v: p5.Vector) => v.y = Math.min(0, v.y)
			}, // bottom
			{
				pos: new p5.Vector(-overshoot, this.pos.y),
				clamp: (v: p5.Vector) => v.x = Math.max(0, v.x),
			}, // left
			{
				pos: new p5.Vector(width + overshoot, this.pos.y),
				clamp: (v: p5.Vector) => v.x = Math.min(0, v.x),
			}, // right
		]

		for (let edge of edges) {
			let dist = this.pos.copy().sub(edge.pos)

			// Ensure that particles can't get to the "invisible" side of the edge.
			edge.clamp(dist)

			let force = dist.copy().normalize().mult(800 / dist.mag())
			this.debugForce(p, force, "yellow", edge.pos)
			this.acc.add(force)
		}
	}

	draw(p: p5, len: number, weight: number, colour: string) {
		p.stroke(colour)
		p.strokeWeight(weight)

		let { start, end } = this.coordinates(len)

		p.line(start.x, start.y, end.x, end.y)
	}

	debugForce(p: p5 | undefined, force: p5.Vector, color: string, pos?: p5.Vector) {
		if (!p) {
			return
		}

		if (!pos) {
			pos = this.pos
		}

		if (force.mag() > 500) {
			// Avoid rendering infinity things. Where does the infinity come from though?
			return
		}

		p.stroke(color)
		p.strokeWeight(1)
		let end = pos.copy().add(force)
		p.line(pos.x, pos.y, end.x, end.y)
	}
}

class Murmuration {
	z0: Bird[] = []
	neighborsT = 0
	predator = new p5.Vector()
	predatorT = 0

	constructor(p: p5, num: number) {
		for (let i = 0; i < num; i++) {
			const x = p.randomGaussian(p.width / 2, p.width / 2 / 4)
			const y = p.randomGaussian(p.height / 2, p.height / 2 / 4)
			let b = new Bird(x, y)
			this.z0.push(b)
		}
	}

	update(p: p5, numNeighbors: number): number {
		let fb0 = new Flatbush(this.z0.length)
		for (let bird of this.z0) {
			fb0.add(bird.pos.x, bird.pos.y)
		}
		fb0.finish()

		let scale = p.map(p.noise(this.neighborsT), 0, 1, -0.5, 1)
		this.neighborsT += 0.02

		// Update predator
		this.predator.x = p.map(p.noise(this.predatorT), 0, 1, 0, p.width)
		this.predator.y = p.map(p.noise(this.predatorT + 1337), 0, 1, 0, p.height)
		this.predatorT += 0.005

		for (let bird of this.z0) {
			let neighborIds = fb0.neighbors(bird.pos.x, bird.pos.y, numNeighbors + 1)
			// The first item is bird itself since it has distance 0.
			neighborIds.shift()
			let neighbors = neighborIds.map((id: number) => this.z0[id])

			bird.update(neighbors, this.predator, scale, p.width, p.height, 50, undefined)
		}

		return scale
	}

	draw(p: p5, len: number, weight: number, color: string) {
		const dt = p.deltaTime / 1000
		for (let bird of this.z0) {
			bird.vel.add(bird.acc)

			let deltaV = bird.vel.copy().mult(dt)
			bird.pos.add(deltaV)
			bird.draw(p, len, weight, color)
		}

		// p.fill("cyan")
		// p.stroke(0)
		// p.circle(this.predator.x, this.predator.y, 10)
	}
}

let sketch = (p: p5) => {
	const numBoids = 400
	let z0: Murmuration
	let z1: Murmuration

	p.setup = () => {
		let canvas = document.getElementById('canvas')!
		const maxNeighbors = numBoids / 4
		let neighborCount = maxNeighbors / 2
		neighborSlider.value = neighborCount.toString()
		neighborSlider.max = maxNeighbors.toString()
		p.createCanvas(canvas.clientWidth, canvas.clientHeight, canvas)

		z0 = new Murmuration(p, numBoids)
		z1 = new Murmuration(p, numBoids)
	}

	p.draw = () => {
		p.background(0)

		let numNeighbors = parseInt(neighborSlider.value)

		let scale = z0.update(p, numNeighbors)
		z1.update(p, numNeighbors)

		separationSlider.value = scale.toString()

		z0.draw(p, 6, 2, "#999")
		z1.draw(p, 10, 3, "#fff")
		// for (let bird of z1) {
		// 	bird.update(direction)
		// 	bird.draw(p)
		// }
	}
}

new p5(sketch)
