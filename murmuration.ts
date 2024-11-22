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
	len: number
	thickness: number
	colour: number

	constructor(p: p5, len: number, thickness: number, colour: number) {
		const x = p.randomGaussian(p.width / 2, p.width / 2 / 4)
		const y = p.randomGaussian(p.height / 2, p.height / 2 / 4)
		this.pos = new p5.Vector(x, y)
		this.vel = new p5.Vector()
		this.acc = new p5.Vector()
		this.len = len
		this.thickness = thickness
		this.colour = colour
	}

	coordinates(): { start: p5.Vector, end: p5.Vector } {
		let direction = p5.Vector.fromAngle(this.vel.heading())
		// TODO: Is there a better way to do this?
		direction.setMag(this.len / 2)
		let start = this.pos.copy().sub(direction)
		let end = this.pos.copy().add(direction)
		return { start, end }
	}

	update(neighbors: Bird[], width: number, height: number, overshoot: number = 0, p?: p5) {
		this.acc = new p5.Vector()

		// Separation: avoid colliding with neighbors.
		// For each neighbour, calculate the distance.
		// If the distance is closer than some threshold, move away in the opposite direction.
		{
			for (let boid of neighbors) {
				let scale = parseFloat(separationSlider.value)
				let dist = this.pos.copy().sub(boid.pos)
				let force = dist.copy().setMag(1 / dist.magSq() * 2000 * scale)
				this.acc = this.acc.add(force)
				this.debugForce(p, force, "green")
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
			this.debugForce(p, force, "blue")
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

			let scale = parseFloat(cohesionSlider.value)
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

	draw(p: p5) {
		p.stroke(this.colour)
		p.strokeWeight(this.thickness)

		let { start, end } = this.coordinates()

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

let sketch = (p: p5) => {
	let z0: Bird[] = []
	let perlinT = 0

	p.setup = () => {
		let canvas = document.getElementById('canvas')!
		p.createCanvas(canvas.clientWidth, canvas.clientHeight, canvas)
		let vel = new p5.Vector(0)
		// vel.setMag(1)
		for (let i = 0; i < 400; i++) {
			let b = new Bird(p, 20, 3, 110)
			z0.push(b)
		}
		// vel.setMag(vel.mag() * 2)
		// for (let i = 0; i < 100; i++) {
		// 	z1.push(new Bird(p, 30, 5, 150, vel))
		// }
	}

	p.draw = () => {
		p.background(0)

		let fb0 = new Flatbush(z0.length)
		for (let bird of z0) {
			fb0.add(bird.pos.x, bird.pos.y)
		}
		fb0.finish()


		const maxNeighbors = z0.length / 4
		let neighborCount = Math.round(p.map(p.noise(perlinT), 0, 1, 6, maxNeighbors))
		neighborSlider.value = neighborCount.toString()
		neighborSlider.max = maxNeighbors.toString()
		perlinT += 0.005

		for (let bird of z0) {
			let neighborIds = fb0.neighbors(bird.pos.x, bird.pos.y, neighborCount + 1)
			// The first item is bird itself since it has distance 0.
			neighborIds.shift()
			let neighbors = neighborIds.map((id: number) => z0[id])

			bird.update(neighbors, p.width, p.height, 0, p)
		}

		const dt = p.deltaTime / 1000
		for (let bird of z0) {
			bird.vel.add(bird.acc)

			let deltaV = bird.vel.copy().mult(dt)
			bird.pos.add(deltaV)
			bird.draw(p)
		}
		// for (let bird of z1) {
		// 	bird.update(direction)
		// 	bird.draw(p)
		// }
	}
}

new p5(sketch)
