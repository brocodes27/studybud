from manim import *
import numpy as np
import os

INDIGO = "#4b0082"
VIOLET = "#7c3aed"

class GeneratedScene(Scene):
    def construct(self):
        self.ctx = {}
        pass

    # ================= CORE =================

    def run_segment(self, duration, fn=None):
        if fn:
            try:
                fn()
            except Exception as e:
                print("⚠️ Segment error:", e)
        self.wait(max(0.1, duration))

    def clear(self):
        if self.mobjects:
            self.play(
                *[FadeOut(m) for m in self.mobjects],
                run_time=0.4,
                lag_ratio=0.05
            )

    # ================= SAFE BUILDERS =================

    def safe_image(self, filename, width=6):
        """
        Loads an image ONLY if it exists.
        Falls back to labeled rectangle otherwise.
        """
        if os.path.exists(filename):
            img = ImageMobject(filename)
            img.set_width(width)
            self.play(FadeIn(img))
            return img

        # Fallback
        box = Rectangle(width=width, height=width * 0.6)
        label = Text(f"[Missing image]\n{filename}", font_size=24)
        label.move_to(box.get_center())

        self.play(Create(box), FadeIn(label))
        return VGroup(box, label)

    def safe_add(self, *mobs):
        for m in mobs:
            if isinstance(m, Mobject):
                self.add(m)

    def safe_plot(self, axes, fn, **kw):
        try:
            return axes.plot(fn, **kw)
        except:
            return VGroup()

    def safe_angle(self, l1, l2, **kw):
        try:
            return Angle(l1, l2, **kw)
        except:
            return VGroup()

    # ================= COMMON VISUALS =================

    def title(self, txt, size=48):
        t = Text(txt, font_size=size)
        self.play(Write(t))
        return t

    def caption(self, txt, size=32):
        c = Text(txt, font_size=size).to_edge(DOWN)
        self.play(FadeIn(c))
        return c

    def text_block(self, txt, size=36):
        t = Text(txt, font_size=size, line_spacing=1.25)
        self.play(Write(t))
        return t

    def math_block(self, tex, size=36):
        m = MathTex(tex, font_size=size)
        self.play(Write(m))
        return m

    def axes_2d(self):
        ax = Axes(
            x_range=[0, 10, 1],
            y_range=[0, 10, 1],
            axis_config={"include_numbers": True}
        )
        self.play(Create(ax))
        return ax
