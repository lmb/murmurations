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
			let dragMag = this.vel.magSq() / 1500
			let drag = this.vel.copy().mult(-1).setMag(dragMag)
			this.acc = this.acc.add(drag)
			this.debugForce(p, drag, "cyan")
		}

		// Repelling force from edges
		const edges = [
			{
				pos: new p5.Vector(this.pos.x, -height / 2 - overshoot),
				clamp: (v: p5.Vector) => v.y = Math.max(-height / 2, v.y),
			}, // top
			{
				pos: new p5.Vector(this.pos.x, height / 2 + overshoot),
				clamp: (v: p5.Vector) => v.y = Math.min(height / 2, v.y)
			}, // bottom
			{
				pos: new p5.Vector(-width / 2 - overshoot, this.pos.y),
				clamp: (v: p5.Vector) => v.x = Math.max(-width / 2, v.x),
			}, // left
			{
				pos: new p5.Vector(width / 2 + overshoot, this.pos.y),
				clamp: (v: p5.Vector) => v.x = Math.min(width / 2, v.x),
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
	birds: Bird[] = []
	neighborsT = 0
	predator = new p5.Vector()
	predatorT = 0

	constructor(p: p5, num: number) {
		for (let i = 0; i < num; i++) {
			const x = p.randomGaussian(0, p.width / 8)
			const y = p.randomGaussian(0, p.height / 8)
			let b = new Bird(x, y)
			this.birds.push(b)
		}
	}

	update(p: p5, numNeighbors: number, deltaT: number): number {
		let fb0 = new Flatbush(this.birds.length)
		for (let bird of this.birds) {
			fb0.add(bird.pos.x, bird.pos.y)
		}
		fb0.finish()

		let scale = p.map(p.noise(this.neighborsT), 0, 1, -0.5, 1)
		this.neighborsT += 0.02

		// Update predator
		this.predator.x = p.map(p.noise(this.predatorT), 0, 1, -p.width / 2, p.width / 2)
		this.predator.y = p.map(p.noise(this.predatorT + 1337), 0, 1, -p.height / 2, p.height / 2)
		this.predatorT += 0.005

		for (let bird of this.birds) {
			let neighborIds = fb0.neighbors(bird.pos.x, bird.pos.y, numNeighbors + 1)
			// The first item is bird itself since it has distance 0.
			neighborIds.shift()
			let neighbors = neighborIds.map((id: number) => this.birds[id])

			bird.update(neighbors, this.predator, scale, p.width, p.height, 50, undefined)
		}

		for (let bird of this.birds) {
			bird.vel.add(bird.acc)

			let deltaV = bird.vel.copy().mult(deltaT)
			bird.pos.add(deltaV)
		}

		return scale
	}
}



// function drawBirdAnaglyph(p: p5, bird: Bird, len: number, weight: number, color: p5.Color, dist: number) {
// 	let redComponent = p.color(p.red(color), 0, 0)
// 	let cyanComponent = p.color(0, p.green(color), p.blue(color))

// 	let line = bird.vel.copy().setMag(len)

// 	p.blendMode(p.ADD)
// 	let left = bird.pos.copy().sub(dist / 2)
// 	drawBird(p, left, line, weight, redComponent)
// 	let right = bird.pos.copy().add(dist / 2)
// 	drawBird(p, right, line, weight, cyanComponent)
// 	p.blendMode(p.BLEND)
// }



let sketch = (p: p5) => {
	const numBoids = 500
	let z0: Murmuration
	let z1: Murmuration
	let z2: Murmuration

	let l0: p5.Framebuffer
	let l1: p5.Framebuffer
	let distanceT = 0

	function drawBird(p: p5, center: p5.Vector, line: p5.Vector, weight: number, color: p5.Color) {
		p.stroke(color)
		p.strokeWeight(weight)

		line = line.copy()
		line.setMag(line.mag() / 2)

		let start = center.copy().sub(line)
		let end = center.copy().add(line)

		p.line(start.x, start.y, end.x, end.y)
	}

	function drawBirds(p: p5, sim: Murmuration, len: number, weight: number, color: p5.Color) {
		for (let bird of sim.birds) {
			let center = bird.pos
			let line = bird.vel.copy().setMag(len)
			drawBird(p, center, line, weight, color)
		}

		// p.fill("cyan")
		// p.stroke(0)
		// p.circle(this.predator.x, this.predator.y, 10)
	}

	function drawBirdsAnaglyph(p: p5, sim: Murmuration, len: number, weight: number, color: p5.Color, dist: number) {
		// layer.begin()
		// p.clear()
		// for (let bird of sim.birds) {
		// 	drawBirdAnaglyph(p, bird, len, weight, color, dist)
		// }
		// layer.end()
		// p.image(layer, -p.width / 2, -p.height / 2)

		l0.begin()
		p.clear()
		drawBirds(p, sim, len, weight, color)
		l0.end()

		l1.begin()
		p.clear()
		p.blendMode(p.ADD)
		p.tint(255, 0, 0)
		p.image(l0, (-p.width / 2) - dist / 2, -p.height / 2)

		p.tint(0, 255, 255)
		p.image(l0, (-p.width / 2) + dist / 2, -p.height / 2)
		l1.end()

		p.blendMode(p.BLEND)
		p.image(l1, (-p.width / 2), -p.height / 2)

		// p.fill("cyan")
		// p.stroke(0)
		// p.circle(this.predator.x, this.predator.y, 10)
	}

	p.setup = () => {
		let canvas = document.getElementById('canvas')!
		const maxNeighbors = numBoids / 4
		let neighborCount = maxNeighbors / 2
		neighborSlider.value = neighborCount.toString()
		neighborSlider.max = maxNeighbors.toString()
		p.createCanvas(canvas.clientWidth, canvas.clientHeight, p.WEBGL, canvas)

		z0 = new Murmuration(p, numBoids)
		z1 = new Murmuration(p, numBoids)
		z2 = new Murmuration(p, numBoids)
		l0 = p.createFramebuffer({ depth: false }) as unknown as p5.Framebuffer
		l1 = p.createFramebuffer({ depth: false }) as unknown as p5.Framebuffer
	}


	p.draw = () => {
		p.background(0)

		let numNeighbors = parseInt(neighborSlider.value)

		const dist1 = p.map(p.noise(distanceT + 999), 0, 1, 7, 12)
		const dist2 = p.map(p.noise(distanceT + 99999), 0, 1, 2, 7)
		separationSlider.value = dist2.toString()
		distanceT += 0.03

		const dt = p.deltaTime / 1000
		// let scale = z0.update(p, numNeighbors, dt)
		let scale = z1.update(p, numNeighbors, dt)
		z2.update(p, numNeighbors, dt)

		cohesionSlider.value = scale.toString()
		// let dist1 = parseFloat(separationSlider.value)

		// z0.draw(p, 4, 1, "#1673f8")
		// z1.draw(p, 6, 2, "#5478b1")

		// drawBirdsAnaglyph(p, l0, z0, 4, 2, p.color("#1673f8"), dist1 * 4)
		drawBirdsAnaglyph(p, z1, 6, 2, p.color("#5478b1"), dist1)
		drawBirdsAnaglyph(p, z2, 10, 3, p.color("#fff"), dist2)

		// for (let bird of z1) {
		// 	bird.update(direction)
		// 	bird.draw(p)
		// }
	}
}

new p5(sketch)
