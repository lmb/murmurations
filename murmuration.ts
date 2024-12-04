import p5 from 'p5'
import Flatbush from 'flatbush'

let neighborSlider = document.getElementById("neighbors")! as HTMLInputElement
let separationSlider = document.getElementById("separation")! as HTMLInputElement
let cohesionSlider = document.getElementById("cohesion")! as HTMLInputElement
let threeDCheckbox = document.getElementById("3d")! as HTMLInputElement
let pauseCheckbox = document.getElementById("pause")! as HTMLInputElement
let forcesCheckbox = document.getElementById("forces")! as HTMLInputElement
let fullscreenButton = document.getElementById("fullscreen")! as HTMLInputElement
let stepButton = document.getElementById("step")! as HTMLInputElement
let canvas = document.getElementById('canvas')! as HTMLCanvasElement

let step = false

class Bird {
	pos: p5.Vector
	vel: p5.Vector
	predatorForce: p5.Vector
	separationForce: p5.Vector
	alignmentForce: p5.Vector
	centerOfMass: p5.Vector
	cohesionForce: p5.Vector
	edgeForce: p5.Vector
	dragForce: p5.Vector

	constructor(x: number, y: number) {
		this.pos = new p5.Vector(x, y)
		this.vel = new p5.Vector()
		this.predatorForce = new p5.Vector()
		this.separationForce = new p5.Vector()
		this.alignmentForce = new p5.Vector()
		this.centerOfMass = new p5.Vector()
		this.cohesionForce = new p5.Vector()
		this.edgeForce = new p5.Vector()
		this.dragForce = new p5.Vector()
	}

	update(neighborIds: number[], allBirds: Bird[], predator: p5.Vector, scale: number, width: number, height: number) {
		{
			this.predatorForce.set(this.pos)
			this.predatorForce.sub(predator)
			this.predatorForce.setMag(800 / this.predatorForce.mag())
		}

		// Separation: avoid colliding with neighbors.
		// For each neighbour, calculate the distance.
		// If the distance is closer than some threshold, move away in the opposite direction.
		{
			this.separationForce.set()
			let tmp = new p5.Vector()
			for (let id of neighborIds) {
				let boid = allBirds[id]
				tmp.set(this.pos)
				tmp.sub(boid.pos)
				tmp.setMag(1 / tmp.magSq() * 2000)
				this.separationForce.add(tmp)
			}
		}

		// Alignment: steer towards average heading.
		// This is the only input of acceleration into the system.
		{
			this.alignmentForce.set()
			for (let id of neighborIds) {
				let boid = allBirds[id]
				let heading = boid.vel.copy().normalize()
				this.alignmentForce.add(heading)
			}
			this.alignmentForce.div(neighborIds.length)

			// Create a steering force towards the average heading
			this.alignmentForce.setMag(10 + 30 * scale)
		}

		// Cohesion: steer towards center of mass of neighbors.
		{
			this.centerOfMass.set()
			this.cohesionForce.set()
			for (let id of neighborIds) {
				let boid = allBirds[id]
				this.centerOfMass.add(boid.pos)
			}
			this.centerOfMass.div(neighborIds.length)

			this.cohesionForce.set(this.centerOfMass)
			this.cohesionForce.sub(this.pos)
			this.cohesionForce.setMag(20 * scale)
		}

		// Repelling force from edges
		{
			this.edgeForce.set()

			let x = Math.max(0, Math.abs(this.pos.x) - (width / 2))
			this.edgeForce.x = Math.sign(this.pos.x) * -1 * (x ** 2) / 200

			let y = Math.max(0, Math.abs(this.pos.y) - (height / 2))
			this.edgeForce.y = Math.sign(this.pos.y) * -1 * (y ** 2) / 200

			this.edgeForce.limit(1000)
		}

		// Drag, must be calculated last to avoid very large
		// intermediate velocity value.
		{
			this.dragForce.set(this.vel)
			this.dragForce.setMag(this.dragForce.magSq() / 1500)
			this.dragForce.mult(-1)
		}
	}
}

class Murmuration {
	birds: Bird[] = []
	neighborsT = 0
	predator = new p5.Vector()
	predatorT = 0

	constructor(p: p5, num: number) {
		for (let i = 0; i < num; i++) {
			const x = p.randomGaussian(0, p.width / 4)
			const y = p.randomGaussian(0, p.height / 4)
			let b = new Bird(x, y)
			this.birds.push(b)
		}
	}

	update(p: p5, numNeighbors: number, deltaT: number, showForces = false): number {
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

		let debugP = undefined
		if (showForces) {
			debugP = p
		}

		for (let bird of this.birds) {
			let neighborIds = fb0.neighbors(bird.pos.x, bird.pos.y, numNeighbors + 1)
			// The first item is bird itself since it has distance 0.
			neighborIds.shift()
			bird.update(neighborIds, this.birds, this.predator, scale, p.width, p.height)
		}

		let acc = new p5.Vector()
		let deltaV = new p5.Vector()
		for (let bird of this.birds) {
			acc.set()
			acc.add(bird.predatorForce)
			acc.add(bird.separationForce)
			acc.add(bird.alignmentForce)
			acc.add(bird.cohesionForce)
			acc.add(bird.edgeForce)
			acc.add(bird.dragForce)

			bird.vel.add(acc)
			deltaV.set(bird.vel)
			deltaV.mult(deltaT)
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

	function debugForce(p: p5, pos: p5.Vector, force: p5.Vector, color: string) {
		p.push()
		p.stroke(color)
		p.strokeWeight(1)
		let end = pos.copy().add(force)
		p.line(pos.x, pos.y, end.x, end.y)
		p.pop()
	}

	function debugForces(p: p5, sim: Murmuration) {
		for (let bird of sim.birds) {
			p.push()
			p.strokeWeight(1)
			p.stroke("red")
			p.translate(bird.centerOfMass)
			p.ellipsoid(1)
			p.pop()

			debugForce(p, bird.pos, bird.edgeForce, "yellow")
			debugForce(p, bird.pos, bird.predatorForce, "red")
		}
	}

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
		const showForces = forcesCheckbox.checked
		let paused = pauseCheckbox.checked

		let dt = Math.min(p.deltaTime / 1000, 1.0)

		if (step) {
			dt = 1.0 / 30 // One frame at 30 fps
			step = false
			paused = false
		}

		const dist1 = p.map(p.noise(distanceT + 999), 0, 1, 5, 10)
		const dist2 = p.map(p.noise(distanceT + 99999), 0, 1, -7, 0)

		if (!paused) {
			separationSlider.value = dist2.toString()
			distanceT += 0.03

			let numNeighbors = parseInt(neighborSlider.value)

			// let scale = z0.update(p, numNeighbors, dt)
			let scale = z1.update(p, numNeighbors, dt, false)
			z2.update(p, numNeighbors, dt, showForces)

			cohesionSlider.value = scale.toString()
			// let dist1 = parseFloat(separationSlider.value)
		}

		let c1 = p.color("#ffc94c")
		let c2 = p.color("#fff")

		p.background(0)

		if (showForces) {
			debugForces(p, z2)
		}

		if (threeDCheckbox.checked) {
			drawBirdsAnaglyph(p, z1, 6, 2, c1, dist1)
			drawBirdsAnaglyph(p, z2, 10, 3, c2, dist2)
		} else {
			drawBirds(p, z1, 6, 2, c1)
			drawBirds(p, z2, 10, 3, c2)
		}

	}
}

new p5(sketch)

document.addEventListener("keydown", (event) => {
	if (event.key === "3") {
		threeDCheckbox.checked = !threeDCheckbox.checked
	} else if (event.key == "p") {
		pauseCheckbox.checked = !pauseCheckbox.checked
	} else if (event.key == "s") {
		step = true
	} else if (event.key == "f") {
		forcesCheckbox.checked = !forcesCheckbox.checked
	}
})

fullscreenButton.addEventListener("click", () => {
	if (canvas.requestFullscreen) {
		canvas.requestFullscreen()
	}
})

stepButton.addEventListener("click", () => {
	step = true
})

declare global {
	interface Window {
		DEBUG?: boolean
	}
}

if (window.DEBUG) {
	new EventSource('/esbuild').addEventListener('change', () => location.reload())
}
