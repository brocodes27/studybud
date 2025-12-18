from manim import *

class GeneratedScene(Scene):
    def construct(self):
        # Segment 1
        # Segment 1
        axes = Axes(x_range=[0, 10, 1], y_range=[0, 10, 1], axis_config={"include_numbers": True})
        scatter_points = VGroup(*[Dot(axes.c2p(x, 0.5 * x + 1 + np.random.normal(0, 0.5))) for x in range(1, 10)])
        caption = Text("The Essence of Linear Regression", font_size=36).to_edge(DOWN)
        
        self.play(Create(axes), FadeIn(scatter_points), Write(caption))
        self.wait(29.74)

        # Segment 2
        # Segment 2
        line = axes.plot(lambda x: 0.5 * x + 1, color=YELLOW)
        equation = MathTex('y = mx + b').next_to(line, UP)
        new_caption = Text("The Core Mechanism", font_size=36).to_edge(DOWN)
        
        self.play(Transform(caption, new_caption), Create(line), Write(equation))
        self.wait(33.60)

        # Segment 3
        # Segment 3
        vertical_lines = VGroup(*[Line(start=dot.get_center(), end=axes.c2p(dot.get_center()[0], 0.5 * dot.get_center()[0] + 1), color=RED) for dot in scatter_points])
        new_caption = Text("The Dance of Least Squares", font_size=36).to_edge(DOWN)
        
        self.play(Transform(caption, new_caption), Create(vertical_lines))
        self.wait(28.78)

        # Segment 4
        # Segment 4
        cityscape = Text("Cityscape: Traffic Flow Predictions", font_size=36).to_edge(UP)
        forest = Text("Forest: Tree Growth Predictions", font_size=36).to_edge(DOWN)
        new_caption = Text("Visual Examples and Applications", font_size=36).to_edge(DOWN)
        
        self.play(FadeOut(VGroup(axes, scatter_points, line, equation, vertical_lines)), Write(cityscape), Write(forest), Transform(caption, new_caption))
        self.wait(27.19)

        # Segment 5
        # Segment 5
        assumptions = Text("Assumptions and Limitations", font_size=36).to_edge(UP)
        new_caption = Text("Beyond the Line—Assumptions and Limitations", font_size=36).to_edge(DOWN)
        
        self.play(FadeOut(VGroup(cityscape, forest)), Write(assumptions), Transform(caption, new_caption))
        self.wait(27.50)

        # Segment 6
        # Segment 6
        symphony = Text("The Power of Visualization", font_size=36).to_edge(UP)
        new_caption = Text("The Power of Visualization", font_size=36).to_edge(DOWN)
        
        self.play(FadeOut(assumptions), Write(symphony), Transform(caption, new_caption))
        self.wait(24.46)

        # Segment 7
        # Segment 7
        conclusion = Text("Conclusion—The Bigger Picture", font_size=36).to_edge(UP)
        final_caption = Text("Conclusion—The Bigger Picture", font_size=36).to_edge(DOWN)
        
        self.play(FadeOut(symphony), Write(conclusion), Transform(caption, final_caption))
        self.wait(38.23)

