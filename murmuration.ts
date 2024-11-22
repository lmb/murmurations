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

	update(neighbors: Bird[], p: p5) {
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

		let forceMag = (dist: number) => {
			dist = Math.abs(dist)
			if (dist > 50) {
				return 0
			}
			let scale = 1 / (dist / 50)
			return 10 * scale
		}

		// Repelling force from edges
		{
			// Top edge
			let edge = new p5.Vector(this.pos.x, 0)
			let dist = this.pos.copy().sub(edge)
			let force = new p5.Vector(0, forceMag(dist.y))
			this.debugForce(p, force, "yellow", edge)
			this.acc.add(force)
		}

		// Bottom edge
		{
			let edge = new p5.Vector(this.pos.x, p.height)
			let dist = this.pos.copy().sub(edge)
			let force = new p5.Vector(0, -forceMag(dist.y))
			this.debugForce(p, force, "yellow", edge)
			this.acc.add(force)
		}

		// Left edge
		{
			let edge = new p5.Vector(0, this.pos.y)
			let dist = this.pos.copy().sub(edge)
			let force = new p5.Vector(forceMag(dist.x), 0)
			this.debugForce(p, force, "yellow", edge)
			this.acc.add(force)
		}

		// Right edge
		{
			let edge = new p5.Vector(p.width, this.pos.y)
			let dist = this.pos.copy().sub(edge)
			let force = new p5.Vector(-forceMag(dist.x), 0)
			this.debugForce(p, force, "yellow", edge)
			this.acc.add(force)
		}
	}

	isVisible(p: p5): boolean {
		return this.pos.x < -100 || this.pos.x > p.width + 100 || this.pos.y < -100 || this.pos.y > p.height + 100
	}

	draw(p: p5) {
		p.stroke(this.colour)
		p.strokeWeight(this.thickness)

		let { start, end } = this.coordinates()

		p.line(start.x, start.y, end.x, end.y)
	}

	debugForce(p: p5, force: p5.Vector, color: string, pos?: p5.Vector) {
		if (p === undefined) {
			return
		}

		if (pos == undefined) {
			pos = this.pos
		}

		p.stroke(color)
		p.strokeWeight(1)
		let end = pos.copy().add(force)
		p.line(pos.x, pos.y, end.x, end.y)
	}
}

let sketch = (p: p5) => {
	let z0: Bird[] = []

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

		let neighborCount = parseInt(neighborSlider.value)

		for (let bird of z0) {
			let neighborIds = fb0.neighbors(bird.pos.x, bird.pos.y, neighborCount + 1)
			// The first item is bird itself since it has distance 0.
			neighborIds.shift()
			let neighbors = neighborIds.map((id: number) => z0[id])

			bird.update(neighbors, p)
		}

		const dt = p.deltaTime / 1000
		const radiansPerSecond = (2 * Math.PI) / 8
		for (let bird of z0) {
			// bird.acc.mult(p.deltaTime / 1000)
			// let angle = bird.vel.angleBetween(bird.acc)
			// if (Math.abs(angle) > radiansPerSecond) {
			// 	angle = bird.vel.heading() + Math.abs(angle) * radiansPerSecond
			// 	// Boids can't turn faster than an 8th of a full rotation
			// 	bird.acc.setHeading(angle)
			// }
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
