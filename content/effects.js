// content/effects.js
// Registry + helpers for particle effects. Keep this file focused on visuals only.

(function () {
    const g = (typeof window !== "undefined" ? window : self);
    const JUICER = g.JUICER = g.JUICER || {};

    // Public API
    JUICER.effects = [];
    JUICER.addEffect = fx => JUICER.effects.push(fx);
    JUICER.runRandomEffect = (el) => {
        if (!JUICER.effects.length || !el) return;
        const fx = JUICER.effects[Math.floor(Math.random() * JUICER.effects.length)];
        if (JUICER.debug) console.log("[Juicer:effects] run", fx.id);
        fx.run(el);
    };

    // ---------- Local helpers ----------
    function rect(el) { return el.getBoundingClientRect(); }
    function originFromRect(r) {
        return {
            x: (r.left + r.width / 2) / g.innerWidth,
            y: (r.top  + r.height / 2) / g.innerHeight
        };
    }
    function confettiAt(el, opts = {}) {
        if (!g.confetti || !el) return;
        const r = rect(el);
        g.confetti(Object.assign({
            particleCount: 140,
            spread: 80,
            startVelocity: 45,
            origin: originFromRect(r)
        }, opts));
    }

    // ---------- Effects (edit/add freely) ----------

    JUICER.addEffect({
        id: "confetti.burst",
        run(el) {
            const r = rect(el), o = originFromRect(r);
            confettiAt(el, {});
            setTimeout(() => {
                g.confetti({ particleCount: 60, angle: 60,  spread: 55, origin: { x: 0,   y: o.y } });
                g.confetti({ particleCount: 60, angle: 120, spread: 55, origin: { x: 1.0, y: o.y } });
            }, 200);
        }
    });

    JUICER.addEffect({
        id: "confetti.cannons",
        run(el) {
            const r = rect(el), oy = originFromRect(r).y;
            g.confetti({ particleCount: 120, angle: 60,  spread: 70, startVelocity: 55, origin: { x: 0,   y: oy } });
            g.confetti({ particleCount: 120, angle: 120, spread: 70, startVelocity: 55, origin: { x: 1.0, y: oy } });
        }
    });

    JUICER.addEffect({
        id: "confetti.fireworks",
        run(el) {
            const base = originFromRect(rect(el));
            for (let i=0;i<4;i++){
                setTimeout(()=>{
                    const jitter = () => (Math.random()-0.5)*0.2;
                    g.confetti({
                        particleCount: 90, spread: 360, startVelocity: 60, ticks: 210, gravity: 0.9,
                        origin: { x: Math.min(Math.max(base.x + jitter(), 0.05), 0.95),
                            y: Math.min(Math.max(base.y + jitter(), 0.15), 0.85) }
                    });
                }, i*180);
            }
        }
    });

    JUICER.addEffect({
        id: "confetti.shower",
        run(el) {
            const base = originFromRect(rect(el));
            const end = Date.now() + 1200;
            (function tick(){
                g.confetti({
                    particleCount: 6 + Math.floor(Math.random()*5),
                    spread: 65, startVelocity: 30, gravity: 1.1,
                    origin: { x: base.x + (Math.random()-0.5)*0.08, y: base.y - 0.05 }
                });
                if (Date.now() < end) requestAnimationFrame(tick);
            })();
        }
    });

    JUICER.addEffect({
        id: "confetti.float",
        run(el) {
            const o = originFromRect(rect(el));
            for (let i=0;i<3;i++){
                setTimeout(()=>{
                    g.confetti({
                        particleCount: 80, spread: 90, startVelocity: 25, gravity: 0.6,
                        scalar: 1.0 + Math.random()*0.4, drift: (Math.random()-0.5)*1.2, ticks: 260,
                        origin: { x: o.x, y: Math.max(o.y - 0.1, 0.05) }
                    });
                }, i*200);
            }
        }
    });

    JUICER.addEffect({
        id: "confetti.stars",
        run(el) {
            g.confetti({
                particleCount: 120, spread: 100, startVelocity: 45, gravity: 0.9,
                shapes: ['star'], scalar: 1.2, origin: originFromRect(rect(el))
            });
        }
    });

    // Emoji shapes (requires canvas-confetti with shapeFromText support)
    const MED_EMOJI = ['🩺','💉','💊','🧬','🩹','🏥','🧪','🫀'];
    let MED_SHAPES = null;
    function ensureEmojiShapes(list, scalar=1.6) {
        if (!g.confetti || typeof g.confetti.shapeFromText !== "function") return null;
        return list.map(ch => g.confetti.shapeFromText({ text: ch, scalar }));
    }

    JUICER.addEffect({
        id: "confetti.medicalEmoji",
        run(el) {
            if (!MED_SHAPES) MED_SHAPES = ensureEmojiShapes(MED_EMOJI, 1.6);
            if (!MED_SHAPES) return JUICER.effects.find(e=>e.id==="confetti.stars")?.run(el);

            const base = originFromRect(rect(el));
            for (let i=0;i<3;i++){
                setTimeout(()=>{
                    g.confetti({
                        particleCount: 60, spread: 75, startVelocity: 42, gravity: 0.95,
                        shapes: MED_SHAPES, scalar: 1.6,
                        origin: { x: base.x + (Math.random()-0.5)*0.04, y: base.y + (Math.random()-0.5)*0.04 }
                    });
                }, i*160);
            }
        }
    });

    // Expose a simple hook to add your own emojis later:
    JUICER.addEmojiEffect = (id, emojiList, scalar=1.6) => {
        JUICER.addEffect({
            id,
            run(el) {
                const shapes = ensureEmojiShapes(emojiList, scalar);
                if (!shapes) return JUICER.effects.find(e=>e.id==="confetti.stars")?.run(el);
                const base = originFromRect(rect(el));
                for (let i=0;i<3;i++){
                    setTimeout(()=>{
                        g.confetti({
                            particleCount: 60, spread: 75, startVelocity: 42, gravity: 0.95,
                            shapes, scalar,
                            origin: { x: base.x + (Math.random()-0.5)*0.04, y: base.y + (Math.random()-0.5)*0.04 }
                        });
                    }, i*160);
                }
            }
        });
    };

    // Optional: flip this on to see effect picks
    JUICER.debug = false;
})();
