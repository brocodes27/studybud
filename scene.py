```python
from manim import *

class GeneratedScene(Scene):
    def construct(self):
        # Title
        title = Text("Protein Structure and Function", font_size=48, color=BLUE)
        self.play(Write(title))
        self.wait(1)
        self.play(title.animate.to_edge(UP))

        # Primary Structure
        primary_structure = Text("Primary Structure", font_size=36, color=YELLOW).next_to(title, DOWN)
        primary_desc = Text("Sequence of amino acids", font_size=24).next_to(primary_structure, DOWN)
        primary_chain = Tex(r"\text{Ala-Gly-Val-Leu}", font_size=36).next_to(primary_desc, DOWN)
        
        self.play(Write(primary_structure))
        self.wait(0.5)
        self.play(Write(primary_desc))
        self.play(Write(primary_chain))
        self.wait(1)

        self.play(FadeOut(primary_desc, primary_chain))

        # Secondary Structure
        secondary_structure = Text("Secondary Structure", font_size=36, color=GREEN).next_to(primary_structure, DOWN, buff=1.5)
        secondary_desc = Text("Alpha helices and Beta sheets", font_size=24).next_to(secondary_structure, DOWN)
        alpha_helix = SVGMobject("alpha_helix.svg").scale(0.5).next_to(secondary_desc, DOWN, buff=0.5)
        beta_sheet = SVGMobject("beta_sheet.svg").scale(0.5).next_to(alpha_helix, RIGHT, buff=1)

        self.play(Write(secondary_structure))
        self.wait(0.5)
        self.play(Write(secondary_desc))
        self.play(FadeIn(alpha_helix, beta_sheet))
        self.wait(1)

        self.play(FadeOut(secondary_desc, alpha_helix, beta_sheet))

        # Tertiary Structure
        tertiary_structure = Text("Tertiary Structure", font_size=36, color=ORANGE).next_to(secondary_structure, DOWN, buff=1.5)
        tertiary_desc = Text("3D folding pattern", font_size=24).next_to(tertiary_structure, DOWN)
        tertiary_image = SVGMobject("tertiary_structure.svg").scale(0.5).next_to(tertiary_desc, DOWN)

        self.play(Write(tertiary_structure))
        self.wait(0.5)
        self.play(Write(tertiary_desc))
        self.play(FadeIn(tertiary_image))
        self.wait(1)

        self.play(FadeOut(tertiary_desc, tertiary_image))

        # Quaternary Structure
        quaternary_structure = Text("Quaternary Structure", font_size=36, color=PURPLE).next_to(tertiary_structure, DOWN, buff=1.5)
        quaternary_desc = Text("Multiple protein subunits", font_size=24).next_to(quaternary_structure, DOWN)
        quaternary_image = SVGMobject("quaternary_structure.svg").scale(0.5).next_to(quaternary_desc, DOWN)

        self.play(Write(quaternary_structure))
        self.wait(0.5)
        self.play(Write(quaternary_desc))
        self.play(FadeIn(quaternary_image))
        self.wait(1)

        self.play(FadeOut(quaternary_desc, quaternary_image))
        
        # Denaturation
        denaturation = Text("Denaturation of Proteins", font_size=36, color=RED).next_to(quaternary_structure, DOWN, buff=1.5)
        denaturation_desc = Text("Loss of structure due to heat, pH, etc.", font_size=24).next_to(denaturation, DOWN)

        self.play(Write(denaturation))
        self.wait(0.5)
        self.play(Write(denaturation_desc))
        self.wait(1)

        self.play(FadeOut(denaturation_desc))

        # Enzymes
        enzymes = Text("Enzymes", font_size=36, color=TEAL).next_to(denaturation, DOWN, buff=1.5)
        enzyme_desc = Text("Biological catalysts", font_size=24).next_to(enzymes, DOWN)
        enzyme_image = SVGMobject("enzyme.svg").scale(0.5).next_to(enzyme_desc, DOWN)

        self.play(Write(enzymes))
        self.wait(0.5)
        self.play(Write(enzyme_desc))
        self.play(FadeIn(enzyme_image))
        self.wait(1)

        self.play(FadeOut(enzyme_desc, enzyme_image))

        # Hormones
        hormones = Text("Hormones", font_size=36, color=GOLD).next_to(enzymes, DOWN, buff=1.5)
        hormone_desc = Text("Chemical messengers", font_size=24).next_to(hormones, DOWN)
        hormone_image = SVGMobject("hormone.svg").scale(0.5).next_to(hormone_desc, DOWN)

        self.play(Write(hormones))
        self.wait(0.5)
        self.play(Write(hormone_desc))
        self.play(FadeIn(hormone_image))
        self.wait(1)

        self.play(FadeOut(hormone_desc, hormone_image))

        # Fade out entire scene
        self.play(FadeOut(title, primary_structure, secondary_structure, tertiary_structure, quaternary_structure,
                          denaturation, enzymes, hormones))
```
