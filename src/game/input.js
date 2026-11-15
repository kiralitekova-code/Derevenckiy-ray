// Player input → intent in state.input. Handlers never move anything; update() does.
// Left side of the screen is a floating joystick; keyboard mirrors it on desktop.
export function createInput({ stage, joy, knob, state, onKey }) {
	const keys = new Set();
	let pointerId = null;
	let origin = { x: 0, y: 0 };
	const RADIUS = 46;

	function setStick(x, y) {
		state.input.mx = x;
		state.input.mz = y;
	}

	function onDown(e) {
		if (e.target.closest("button, [role='button'], .panel, .overlay, .hud-top")) return;
		if (pointerId !== null) return;
		const rect = stage.getBoundingClientRect();
		const lx = e.clientX - rect.left;
		// The joystick owns the left 60% of the stage; the right side keeps the buttons.
		if (lx > rect.width * 0.6) return;
		e.preventDefault();
		pointerId = e.pointerId;
		stage.setPointerCapture?.(e.pointerId);
		origin = { x: e.clientX, y: e.clientY };
		joy.classList.add("active");
		const jr = joy.parentElement.getBoundingClientRect();
		joy.style.left = `${e.clientX - jr.left}px`;
		joy.style.top = `${e.clientY - jr.top}px`;
		knob.style.transform = "translate(-50%, -50%)";
		state.input.touched = true;
	}
	function onMove(e) {
		if (e.pointerId !== pointerId) return;
		let dx = e.clientX - origin.x;
		let dy = e.clientY - origin.y;
		const d = Math.hypot(dx, dy);
		if (d > RADIUS) {
			dx = (dx / d) * RADIUS;
			dy = (dy / d) * RADIUS;
		}
		knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
		const mag = Math.min(1, d / RADIUS);
		setStick(mag < 0.15 ? 0 : (dx / RADIUS), mag < 0.15 ? 0 : (dy / RADIUS));
	}
	function onUp(e) {
		if (e.pointerId !== pointerId) return;
		pointerId = null;
		joy.classList.remove("active");
		joy.style.left = "";
		joy.style.top = "";
		knob.style.transform = "translate(-50%, -50%)";
		setStick(0, 0);
	}

	const keyDir = () => {
		let x = 0, z = 0;
		if (keys.has("KeyA") || keys.has("ArrowLeft")) x -= 1;
		if (keys.has("KeyD") || keys.has("ArrowRight")) x += 1;
		if (keys.has("KeyW") || keys.has("ArrowUp")) z -= 1;
		if (keys.has("KeyS") || keys.has("ArrowDown")) z += 1;
		const d = Math.hypot(x, z) || 1;
		state.input.kx = x / d;
		state.input.kz = z / d;
	};
	function onKeyDown(e) {
		if (e.target.closest?.("input, textarea")) return;
		if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
			keys.add(e.code);
			keyDir();
			e.preventDefault();
			return;
		}
		if (e.repeat) return;
		if (e.code === "Space" || e.code === "KeyE" || e.code === "Enter") {
			e.preventDefault();
			onKey("action");
		} else if (e.code === "KeyI") onKey("bag");
		else if (e.code === "KeyB") onKey("build");
		else if (e.code === "KeyO") onKey("orders");
		else if (e.code === "Escape") onKey("close");
	}
	function onKeyUp(e) {
		keys.delete(e.code);
		keyDir();
	}
	// Held keys and touches are dropped when the window loses focus.
	function clear() {
		keys.clear();
		keyDir();
		if (pointerId !== null) onUp({ pointerId });
	}

	stage.addEventListener("pointerdown", onDown);
	stage.addEventListener("pointermove", onMove);
	stage.addEventListener("pointerup", onUp);
	stage.addEventListener("pointercancel", onUp);
	window.addEventListener("keydown", onKeyDown);
	window.addEventListener("keyup", onKeyUp);
	window.addEventListener("blur", clear);

	return {
		clear,
		destroy() {
			stage.removeEventListener("pointerdown", onDown);
			stage.removeEventListener("pointermove", onMove);
			stage.removeEventListener("pointerup", onUp);
			stage.removeEventListener("pointercancel", onUp);
			window.removeEventListener("keydown", onKeyDown);
			window.removeEventListener("keyup", onKeyUp);
			window.removeEventListener("blur", clear);
		},
	};
}
