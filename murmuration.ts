import p5 from 'p5'
import Flatbush from 'flatbush'

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
				let dist = this.pos.copy().sub(boid.pos)
				// if (dist.mag() < 20) {
				let force = dist.copy().setMag(1 / dist.magSq() * 2000)
				this.acc = this.acc.add(force)
				// }
				// Force becomes larger the smaller the distance.
				// debugger
				// let force = dist.normalize()

				// 		// this.acc.add(Math.min(1 / dist ** 2, 1.0))
			}
		}

		// Alignment: steer towards center of mass of neighbors.
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

			const force = centerOfMass.sub(this.pos).setMag(20)
			this.acc = this.acc.add(force)
		}

		// Drag
		{
			let dragMag = this.vel.magSq() / 1000
			let drag = this.vel.copy().mult(-1).setMag(dragMag)
			this.acc = this.acc.add(drag)
		}

		// Repelling force from edges
		// {
		// 	// Top edge
		// 	let edge = new p5.Vector(this.pos.x, 0)
		// 	let dist = this.pos.copy().sub(edge)
		// 	// A force that is the opposite of the x component of velocity when distance is 0.
		// 	let forceMag = this.vel.y / ((dist.y + 1)) * -1
		// 	let force = new p5.Vector(0, forceMag)

		// 	if (p) {
		// 		let end = edge.copy().add(force)
		// 		p.stroke("red")
		// 		p.line(edge.x, edge.y, end.x, end.y)
		// 	}

		// 	this.acc.add(force)
		// }

		// {
		// 	// Bottom edge
		// 	let edge = new p5.Vector(this.pos.x, p.height)
		// 	let dist = this.pos.copy().sub(edge)
		// 	// A force that is the opposite of the x component of velocity when distance is 0.
		// 	let forceMag = this.vel.y / ((dist.y + 1)) * -1
		// 	let force = new p5.Vector(0, forceMag)

		// 	if (p) {
		// 		let end = edge.copy().add(force)
		// 		p.stroke("red")
		// 		p.line(edge.x, edge.y, end.x, end.y)
		// 	}

		// 	this.acc.add(force)
		// }

		// {
		// 	// Left edge
		// 	let edge = new p5.Vector(0, this.pos.y)
		// 	let dist = this.pos.copy().sub(edge)
		// 	// A force that is the opposite of the x component of velocity when distance is 0.
		// 	let forceMag = this.vel.x / ((dist.x + 1)) * -1
		// 	let force = new p5.Vector(forceMag, 0)

		// 	if (p) {
		// 		let end = edge.copy().add(force)
		// 		p.stroke("red")
		// 		p.line(edge.x, edge.y, end.x, end.y)
		// 	}

		// 	this.acc.add(force)
		// }
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
}

let sketch = (p: p5) => {
	let z0: Bird[] = []

	p.setup = () => {
		p.createCanvas(window.innerWidth, window.innerHeight)
		let vel = new p5.Vector(0)
		// vel.setMag(1)
		for (let i = 0; i < 100; i++) {
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
		let mouse = p.createVector(p.mouseX, p.mouseY)
		let center = p.createVector(p.width / 2, p.height / 2)
		let direction = mouse.copy().sub(center).normalize()
		let fb0 = new Flatbush(z0.length)
		for (let bird of z0) {
			fb0.add(bird.pos.x, bird.pos.y)
		}
		fb0.finish()

		for (let bird of z0) {
			let neighborIds = fb0.neighbors(bird.pos.x, bird.pos.y, 6)
			let neighbors = neighborIds.map((id: number) => z0[id])

			bird.update(neighbors, p)
		}

		const dt = p.deltaTime / 1000
		for (let bird of z0) {
			// bird.acc.mult(p.deltaTime / 1000)
			bird.vel.add(bird.acc)
			// if (bird.vel.mag() > 200) {
			// 	// Boids can't move more than 200px per second.
			// 	bird.vel.setMag(200)
			// }
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