import p5 from 'p5';

let sketch = (p: p5) => {
	p.setup = () => {
		p.createCanvas(window.innerWidth, window.innerHeight);
	}

	p.draw = () => {
		p.background(0);
	}
}

new p5(sketch);
