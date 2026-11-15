// Sound, all synthesized: soft foley-like effects from filtered noise and
// tones, and a gentle folk loop rendered once into a buffer. Everything goes
// through master → (music | sfx) gains; mute zeroes the master.
export function createAudio(sdk) {
	let audio = null;
	let ctx = null;
	let master, musicGain, sfxGain, noise;
	let musicBuffer = null;
	let musicSource = null;
	let wantMusic = true;
	let paused = false;
	let volumes = { music: 0.35, sfx: 0.8, muted: false };
	const last = {};

	sdk.audio.getContext().then((a) => {
		audio = a;
		ctx = a.context;
		master = ctx.createGain();
		master.connect(ctx.destination);
		musicGain = ctx.createGain();
		sfxGain = ctx.createGain();
		musicGain.connect(master);
		sfxGain.connect(master);
		applyVolumes();
		noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
		const d = noise.getChannelData(0);
		for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
		a.onStateChange?.(() => syncMusic());
	}).catch(() => {});

	function applyVolumes() {
		if (!ctx) return;
		const t = ctx.currentTime;
		master.gain.setValueAtTime(volumes.muted ? 0 : 1, t);
		musicGain.gain.setValueAtTime(volumes.music * 0.5, t);
		sfxGain.gain.setValueAtTime(volumes.sfx, t);
	}

	// Called from the first real tap; never awaited by gameplay.
	function unlock() {
		if (!audio) return;
		audio.unlock().then(() => syncMusic()).catch(() => {});
	}

	const running = () => ctx && ctx.state === "running";

	function env(g, t, a, peak, dur) {
		g.gain.setValueAtTime(0.0001, t);
		g.gain.exponentialRampToValueAtTime(peak, t + a);
		g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
	}
	function tone(type, f0, f1, dur, vol, { at = 0, attack = 0.005, filter = null } = {}) {
		const t = ctx.currentTime + at;
		const o = ctx.createOscillator();
		const g = ctx.createGain();
		o.type = type;
		o.frequency.setValueAtTime(f0, t);
		if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
		env(g, t, attack, vol, dur);
		let node = o;
		if (filter) {
			const f = ctx.createBiquadFilter();
			f.type = filter.type;
			f.frequency.value = filter.f;
			f.Q.value = filter.q ?? 1;
			o.connect(f);
			node = f;
		}
		node.connect(g).connect(sfxGain);
		o.start(t);
		o.stop(t + dur + 0.05);
		return o;
	}
	function hiss(type, f0, f1, dur, vol, { at = 0, attack = 0.005, q = 1 } = {}) {
		const t = ctx.currentTime + at;
		const s = ctx.createBufferSource();
		s.buffer = noise;
		s.loop = true;
		const f = ctx.createBiquadFilter();
		f.type = type;
		f.Q.value = q;
		f.frequency.setValueAtTime(f0, t);
		if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
		const g = ctx.createGain();
		env(g, t, attack, vol, dur);
		s.connect(f).connect(g).connect(sfxGain);
		s.start(t, Math.random() * 0.5);
		s.stop(t + dur + 0.05);
	}

	const SOUNDS = {
		dig() { hiss("lowpass", 900, 300, 0.18, 0.5); tone("sine", 130, 70, 0.12, 0.35); },
		chop() { hiss("bandpass", 1800, 900, 0.07, 0.6, { q: 2 }); tone("triangle", 220, 120, 0.1, 0.3); },
		water() { hiss("bandpass", 2400, 900, 0.55, 0.22, { attack: 0.05, q: 1.5 }); hiss("highpass", 4000, 3000, 0.4, 0.06, { attack: 0.04 }); },
		harvest() { tone("sine", 320, 760, 0.11, 0.35); hiss("bandpass", 1200, 2400, 0.12, 0.18, { q: 2 }); },
		splash() { hiss("highpass", 700, 1600, 0.45, 0.35, { attack: 0.01 }); tone("sine", 500, 180, 0.15, 0.15); },
		plop() { tone("sine", 700, 180, 0.13, 0.35); },
		whoosh() { hiss("bandpass", 350, 1800, 0.35, 0.3, { attack: 0.08, q: 1.2 }); },
		hammer() { hiss("bandpass", 2600, 1800, 0.05, 0.4, { q: 3 }); tone("triangle", 190, 150, 0.09, 0.3); },
		cluck() { for (const at of [0, 0.12]) tone("square", 720, 480, 0.08, 0.12, { at, filter: { type: "bandpass", f: 1100, q: 3 } }); },
		moo() {
			const o = tone("sawtooth", 150, 118, 0.9, 0.18, { attack: 0.12, filter: { type: "lowpass", f: 650, q: 4 } });
			const lfo = ctx.createOscillator();
			const lg = ctx.createGain();
			lfo.frequency.value = 5;
			lg.gain.value = 4;
			lfo.connect(lg).connect(o.frequency);
			lfo.start();
			lfo.stop(ctx.currentTime + 1);
		},
		baa() {
			const o = tone("sawtooth", 330, 290, 0.55, 0.12, { attack: 0.04, filter: { type: "lowpass", f: 1400, q: 3 } });
			const lfo = ctx.createOscillator();
			const lg = ctx.createGain();
			lfo.frequency.value = 22;
			lg.gain.value = 18;
			lfo.connect(lg).connect(o.frequency);
			lfo.start();
			lfo.stop(ctx.currentTime + 0.6);
		},
		coin() { tone("sine", 988, 988, 0.09, 0.22); tone("sine", 1319, 1319, 0.22, 0.22, { at: 0.07 }); },
		blip() { tone("sine", 660, 720, 0.07, 0.16); },
		deny() { tone("square", 200, 150, 0.16, 0.06, { filter: { type: "lowpass", f: 900 } }); },
		place() { tone("triangle", 440, 660, 0.1, 0.25); hiss("bandpass", 1600, 900, 0.06, 0.25, { q: 2 }); },
		catch() { [523, 659, 784, 1047].forEach((f, i) => tone("sine", f, f, 0.22, 0.2, { at: i * 0.08 })); },
		fanfare() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone("triangle", f, f, 0.32, 0.18, { at: i * 0.1 })); },
		built() { [392, 523, 659, 784].forEach((f, i) => tone("triangle", f, f, 0.3, 0.2, { at: i * 0.11 })); hiss("highpass", 3000, 6000, 0.6, 0.05, { at: 0.3 }); },
		morning() { [587, 740, 880, 1175].forEach((f, i) => tone("sine", f, f, 0.5, 0.14, { at: i * 0.16, attack: 0.03 })); },
		ui() { tone("sine", 880, 880, 0.04, 0.1); },
	};

	function play(name, gap = 0.05) {
		if (!running() || !SOUNDS[name]) return;
		const now = ctx.currentTime;
		if (now - (last[name] ?? -1) < gap) return;
		last[name] = now;
		try { SOUNDS[name](); } catch { /* sound is optional */ }
	}

	// --- Music: a 24-bar folk loop in D major, rendered once -----------------------------------
	function renderMusic() {
		const sr = 22050;
		const bpm = 84;
		const beat = 60 / bpm;
		const bars = 24;
		const len = Math.floor(bars * 4 * beat * sr);
		const L = new Float32Array(len);
		const R = new Float32Array(len);
		const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
		const CH = {
			D: [62, 66, 69], G: [67, 71, 74], A: [64, 69, 73], Bm: [62, 66, 71], Em: [64, 67, 71],
		};
		const ROOT = { D: 50, G: 43, A: 45, Bm: 47, Em: 40 };
		const prog = ["D", "G", "A", "D", "Bm", "G", "Em", "A", "D", "G", "A", "D"];
		let seed = 3;
		const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
		const add = (midi, start, dur, vol, voice, pan) => {
			const f = mtof(midi);
			const s0 = Math.floor(start * sr);
			const n = Math.floor((dur + (voice === "pad" ? 0.9 : 0.6)) * sr);
			const att = voice === "pad" ? 0.25 : voice === "pluck" ? 0.006 : 0.03;
			const lp = Math.cos(((pan + 1) * Math.PI) / 4);
			const rp = Math.sin(((pan + 1) * Math.PI) / 4);
			for (let i = 0; i < n; i++) {
				const t = i / sr;
				let e = t < att ? Math.pow(Math.sin((t / att) * Math.PI * 0.5), 2) : 1;
				if (voice === "pluck") e *= Math.exp(-t * 3.2);
				else if (t > dur) e *= Math.pow(Math.cos(Math.min(1, (t - dur) / (voice === "pad" ? 0.9 : 0.6)) * Math.PI * 0.5), 2);
				if (voice === "pad") e *= 0.9 + 0.1 * Math.sin(t * 2.1);
				const ph = 2 * Math.PI * f * t;
				let v = Math.sin(ph);
				if (voice === "pluck") v += 0.35 * Math.sin(ph * 2) * Math.exp(-t * 6) + 0.12 * Math.sin(ph * 3) * Math.exp(-t * 9);
				else v += 0.04 * Math.sin(ph * 2);
				const s = v * e * vol;
				const idx = (s0 + i) % len;
				L[idx] += s * lp;
				R[idx] += s * rp;
			}
		};
		const barDur = 4 * beat;
		for (let b = 0; b < bars; b++) {
			const ch = prog[Math.floor(b / 2) % prog.length];
			const t0 = b * barDur;
			if (b % 2 === 0) {
				CH[ch].forEach((m, i) => add(m, t0 + i * 0.12, barDur * 2 - 0.3, 0.05, "pad", -0.5 + i * 0.5));
			}
			add(ROOT[ch], t0, beat * 1.6, 0.11, "bass", 0);
			add(ROOT[ch] + 7, t0 + beat * 2, beat * 1.4, 0.08, "bass", 0);
			// Melody: sparse plucks from the chord and its pentatonic neighbours; some bars rest.
			const rest = b % 8 === 7 || (b > 12 && b % 6 === 5);
			if (!rest) {
				const scale = [...CH[ch].map((m) => m + 12), CH[ch][0] + 24];
				const rhythm = [[0, 1, 2, 2.5, 3], [0, 1.5, 2, 3], [0, 0.5, 1, 2], [0, 2, 3, 3.5]][Math.floor(rnd() * 4)];
				for (const r of rhythm) {
					const m = scale[Math.floor(rnd() * scale.length)];
					add(m, t0 + r * beat, beat * 0.6, 0.075 + rnd() * 0.03, "pluck", 0.25);
					if (rnd() < 0.25) add(m - 12, t0 + r * beat + 0.02, beat * 0.5, 0.03, "pluck", -0.3);
				}
			}
		}
		let peak = 0;
		for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
		const k = peak > 0.9 ? 0.9 / peak : 1;
		const buf = ctx.createBuffer(2, len, sr);
		const cl = buf.getChannelData(0);
		const cr = buf.getChannelData(1);
		for (let i = 0; i < len; i++) {
			cl[i] = L[i] * k;
			cr[i] = R[i] * k;
		}
		return buf;
	}

	function syncMusic() {
		if (!running()) return;
		const should = wantMusic && !paused && volumes.music > 0 && !volumes.muted;
		if (should && !musicSource) {
			if (!musicBuffer) musicBuffer = renderMusic();
			musicSource = ctx.createBufferSource();
			musicSource.buffer = musicBuffer;
			musicSource.loop = true;
			musicSource.connect(musicGain);
			musicSource.start();
		} else if (!should && musicSource) {
			musicSource.stop();
			musicSource.disconnect();
			musicSource = null;
		}
	}

	return {
		unlock,
		play,
		setVolumes(v) {
			volumes = { ...volumes, ...v };
			applyVolumes();
			syncMusic();
		},
		setPaused(p) {
			if (p === paused) return;
			paused = p;
			syncMusic();
		},
		destroy() {
			wantMusic = false;
			syncMusic();
		},
	};
}
