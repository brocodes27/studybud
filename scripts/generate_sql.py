import json

def generate_weekly_schedule():
    schedule = []
    
    physics = [
        {"weeks": [1, 2], "topic": "Units, Dimensions & Measurement", "subtopics": ["SI units", "Dimensional analysis", "Significant figures", "Errors in measurement"]},
        {"weeks": [3, 4], "topic": "Kinematics (1D)", "subtopics": ["Displacement vs distance", "Equations of motion", "Relative motion", "Graphs of motion"]},
        {"weeks": [5, 6], "topic": "Kinematics (2D) & Projectile Motion", "subtopics": ["Projectile motion", "Relative velocity in 2D", "River-boat problems", "Rain problems"]},
        {"weeks": [7, 8], "topic": "Newton's Laws of Motion", "subtopics": ["Free body diagrams", "Pseudo forces", "Constraint motion", "Connected systems"]},
        {"weeks": [9, 10], "topic": "Friction", "subtopics": ["Static & kinetic friction", "Angle of repose", "Friction on incline", "Circular motion with friction"]},
        {"weeks": [11, 12], "topic": "Work, Energy & Power", "subtopics": ["Work-energy theorem", "Conservative forces", "Potential energy curves", "Power"]},
        {"weeks": [13, 14], "topic": "Centre of Mass & Collisions", "subtopics": ["COM of systems", "Elastic & inelastic collisions", "Coefficient of restitution", "Variable mass systems"]},
        {"weeks": [15, 16], "topic": "Rotational Mechanics", "subtopics": ["Moment of inertia", "Torque", "Angular momentum", "Rolling motion"]},
        {"weeks": [17, 18], "topic": "Gravitation", "subtopics": ["Gravitational field", "Potential", "Orbital mechanics", "Keplers laws"]},
        {"weeks": [19, 20], "topic": "Properties of Solids & Fluids", "subtopics": ["Elasticity", "Fluid statics", "Bernoullis equation", "Viscosity & surface tension"]},
        {"weeks": [21, 22], "topic": "Simple Harmonic Motion", "subtopics": ["SHM equation", "Spring systems", "Pendulums", "Superposition of SHMs"]},
        {"weeks": [23, 24], "topic": "Waves & Sound", "subtopics": ["Wave equation", "Standing waves", "Doppler effect", "Beats & resonance"]},
        {"weeks": [25, 26], "topic": "Thermal Properties & Calorimetry", "subtopics": ["Heat transfer", "Thermal expansion", "Calorimetry", "Specific heat"]},
        {"weeks": [27, 28], "topic": "Kinetic Theory of Gases", "subtopics": ["Ideal gas", "RMS speed", "Degrees of freedom", "Mean free path"]},
        {"weeks": [29, 30], "topic": "Thermodynamics", "subtopics": ["First law", "Processes (iso/adia/poly)", "Carnot cycle", "Entropy"]},
        {"weeks": [31, 32], "topic": "Ray Optics", "subtopics": ["Reflection", "Refraction", "Prisms", "Lenses & mirrors"]},
        {"weeks": [33, 34], "topic": "Wave Optics", "subtopics": ["Interference", "YDSE", "Diffraction", "Polarisation"]},
        {"weeks": [35, 36], "topic": "Electrostatics", "subtopics": ["Coulombs law", "Electric field", "Gauss law", "Potential"]},
        {"weeks": [37, 38], "topic": "Capacitance", "subtopics": ["Parallel plate", "Combinations", "Dielectrics", "Energy stored"]},
        {"weeks": [39, 40], "topic": "Current Electricity", "subtopics": ["Ohms law", "Kirchhoffs laws", "Wheatstone bridge", "RC circuits"]},
        {"weeks": [41, 42], "topic": "Magnetic Effects of Current", "subtopics": ["Biot-Savart law", "Amperes law", "Force on conductor", "Solenoids"]},
        {"weeks": [43, 44], "topic": "Electromagnetic Induction", "subtopics": ["Faradays law", "Lenzs law", "Self & mutual inductance", "LC oscillations"]},
        {"weeks": [45, 46], "topic": "AC Circuits & EM Waves", "subtopics": ["RLC circuits", "Resonance", "Transformers", "EM spectrum"]},
        {"weeks": [47, 48], "topic": "Dual Nature of Matter & Radiation", "subtopics": ["Photoelectric effect", "de Broglie wavelength", "Davisson-Germer", "Photon momentum"]},
        {"weeks": [49, 50], "topic": "Atoms & Nuclei", "subtopics": ["Bohr model", "Hydrogen spectrum", "Nuclear binding energy", "Radioactivity"]},
        {"weeks": [51, 52], "topic": "Semiconductors & Communication", "subtopics": ["p-n junction", "Transistors", "Logic gates", "Communication systems"]}
    ]

    chemistry = [
        {"weeks": [1, 2], "topic": "Some Basic Concepts of Chemistry", "subtopics": ["Mole concept", "Stoichiometry", "Limiting reagent", "Concentration terms"]},
        {"weeks": [3, 4], "topic": "Structure of Atom", "subtopics": ["Bohrs model", "Quantum numbers", "Orbitals", "Electronic configuration"]},
        {"weeks": [5, 6], "topic": "Chemical Bonding", "subtopics": ["VSEPR theory", "Hybridization", "MOT", "Hydrogen bonding"]},
        {"weeks": [7, 8], "topic": "States of Matter (Gases)", "subtopics": ["Gas laws", "Kinetic molecular theory", "Real gases", "Liquefaction"]},
        {"weeks": [9, 10], "topic": "Chemical Thermodynamics", "subtopics": ["Enthalpy", "Hesss law", "Entropy", "Gibbs free energy"]},
        {"weeks": [11, 12], "topic": "Chemical Equilibrium", "subtopics": ["Law of mass action", "Le Chateliers principle", "Kp Kc relations", "Simultaneous equilibria"]},
        {"weeks": [13, 14], "topic": "Ionic Equilibrium", "subtopics": ["pH", "Buffers", "Solubility product", "Common ion effect"]},
        {"weeks": [15, 16], "topic": "Redox Reactions & Electrochemistry", "subtopics": ["Balancing redox", "Nernst equation", "Electrolysis", "Galvanic cells"]},
        {"weeks": [17, 18], "topic": "Chemical Kinetics", "subtopics": ["Rate laws", "Order of reaction", "Arrhenius equation", "Half-life"]},
        {"weeks": [19, 20], "topic": "Solutions & Colligative Properties", "subtopics": ["Raoults law", "Osmotic pressure", "Vant Hoff factor", "Abnormal molar mass"]},
        {"weeks": [21, 22], "topic": "Periodic Table & Properties", "subtopics": ["Periodic trends", "Ionization energy", "Electron affinity", "Electronegativity"]},
        {"weeks": [23, 24], "topic": "s-Block Elements", "subtopics": ["Alkali metals", "Alkaline earth metals", "Important compounds", "Diagonal relationship"]},
        {"weeks": [25, 26], "topic": "p-Block Elements (Group 13-14)", "subtopics": ["Boron family", "Carbon family", "Important compounds", "Allotropy"]},
        {"weeks": [27, 28], "topic": "p-Block Elements (Group 15-18)", "subtopics": ["Nitrogen family", "Oxygen family", "Halogens", "Noble gases"]},
        {"weeks": [29, 30], "topic": "d-Block & f-Block Elements", "subtopics": ["Transition metals", "Properties", "KMnO4 K2Cr2O7", "Lanthanides Actinides"]},
        {"weeks": [31, 32], "topic": "Coordination Compounds", "subtopics": ["Werner theory", "Nomenclature", "Isomerism", "CFT & VBT"]},
        {"weeks": [33, 34], "topic": "Metallurgy & Qualitative Analysis", "subtopics": ["Extraction principles", "Ellingham diagram", "Salt analysis", "Flame tests"]},
        {"weeks": [35, 36], "topic": "Basics of Organic Chemistry", "subtopics": ["IUPAC nomenclature", "Isomerism", "Electronic effects", "Reaction intermediates"]},
        {"weeks": [37, 38], "topic": "Hydrocarbons", "subtopics": ["Alkanes", "Alkenes", "Alkynes", "Aromatic hydrocarbons"]},
        {"weeks": [39, 40], "topic": "Alkyl Halides & Aryl Halides", "subtopics": ["SN1 SN2", "Elimination", "Grignard reagent", "Organometallics"]},
        {"weeks": [41, 42], "topic": "Alcohols, Phenols & Ethers", "subtopics": ["Preparation", "Reactions", "Acidity comparison", "Williamson synthesis"]},
        {"weeks": [43, 44], "topic": "Aldehydes, Ketones & Carboxylic Acids", "subtopics": ["Nucleophilic addition", "Aldol condensation", "Cannizzaro", "Acid derivatives"]},
        {"weeks": [45, 46], "topic": "Amines & Diazonium Salts", "subtopics": ["Basicity", "Preparation", "Hofmann", "Diazo coupling"]},
        {"weeks": [47, 48], "topic": "Biomolecules & Polymers", "subtopics": ["Carbohydrates", "Amino acids", "Nucleic acids", "Polymer types"]},
        {"weeks": [49, 50], "topic": "Chemistry in Everyday Life", "subtopics": ["Drugs", "Soaps & detergents", "Food chemistry", "Environmental chemistry"]},
        {"weeks": [51, 52], "topic": "Surface Chemistry & Nuclear Chemistry", "subtopics": ["Adsorption", "Colloids", "Catalysis", "Nuclear reactions"]}
    ]

    mathematics = [
        {"weeks": [1, 2], "topic": "Sets, Relations & Functions", "subtopics": ["Set operations", "Types of relations", "Types of functions", "Composition"]},
        {"weeks": [3, 4], "topic": "Complex Numbers", "subtopics": ["Algebra of complex numbers", "Argand plane", "De Moivres theorem", "nth roots of unity"]},
        {"weeks": [5, 6], "topic": "Quadratic Equations", "subtopics": ["Nature of roots", "Vietas formulas", "Graphs of quadratics", "Location of roots"]},
        {"weeks": [7, 8], "topic": "Sequences & Series", "subtopics": ["AP", "GP", "HP", "AGP", "Special sums", "Method of differences"]},
        {"weeks": [9, 10], "topic": "Binomial Theorem", "subtopics": ["General term", "Middle term", "Properties of coefficients", "Multinomial"]},
        {"weeks": [11, 12], "topic": "Permutations & Combinations", "subtopics": ["Fundamental principle", "Arrangements", "Selections", "Derangements"]},
        {"weeks": [13, 14], "topic": "Probability", "subtopics": ["Conditional probability", "Bayes theorem", "Random variables", "Binomial distribution"]},
        {"weeks": [15, 16], "topic": "Matrices & Determinants", "subtopics": ["Matrix operations", "Determinant properties", "Cramers rule", "Adjoint & inverse"]},
        {"weeks": [17, 18], "topic": "Trigonometric Functions & Identities", "subtopics": ["Compound angles", "Multiple angles", "Sum-product formulas", "Conditional identities"]},
        {"weeks": [19, 20], "topic": "Trigonometric Equations & Inverse Trig", "subtopics": ["General solutions", "Principal values", "Properties of inverse trig", "Composition"]},
        {"weeks": [21, 22], "topic": "Properties of Triangles", "subtopics": ["Sine rule", "Cosine rule", "Area formulas", "Circumradius & inradius"]},
        {"weeks": [23, 24], "topic": "Limits & Continuity", "subtopics": ["Standard limits", "L Hopitals rule", "Squeeze theorem", "Types of discontinuity"]},
        {"weeks": [25, 26], "topic": "Differentiability & Differentiation", "subtopics": ["First principles", "Chain rule", "Implicit differentiation", "Logarithmic differentiation"]},
        {"weeks": [27, 28], "topic": "Application of Derivatives", "subtopics": ["Tangent & normal", "Monotonicity", "Maxima & minima", "Rolles & LMVT"]},
        {"weeks": [29, 30], "topic": "Indefinite Integration", "subtopics": ["Standard integrals", "Substitution", "Partial fractions", "Integration by parts"]},
        {"weeks": [31, 32], "topic": "Definite Integration", "subtopics": ["Properties", "Leibniz rule", "Wallis formula", "Reduction formulas"]},
        {"weeks": [33, 34], "topic": "Area Under Curves", "subtopics": ["Area between curves", "Standard areas", "Parametric areas", "Polar coordinates"]},
        {"weeks": [35, 36], "topic": "Differential Equations", "subtopics": ["Variable separable", "Homogeneous", "Linear DE", "Exact DE"]},
        {"weeks": [37, 38], "topic": "Straight Lines", "subtopics": ["Forms of line equation", "Family of lines", "Angle bisectors", "Concurrency"]},
        {"weeks": [39, 40], "topic": "Circles", "subtopics": ["Standard forms", "Family of circles", "Radical axis", "Common tangents"]},
        {"weeks": [41, 42], "topic": "Parabola", "subtopics": ["Standard forms", "Tangent & normal", "Chord of contact", "Focal chord"]},
        {"weeks": [43, 44], "topic": "Ellipse & Hyperbola", "subtopics": ["Standard forms", "Eccentricity", "Tangent & normal", "Conjugate diameters"]},
        {"weeks": [45, 46], "topic": "Vectors", "subtopics": ["Dot & cross product", "Triple products", "Section formula", "Linear dependence"]},
        {"weeks": [47, 48], "topic": "3D Geometry", "subtopics": ["Direction cosines", "Line equations", "Plane equations", "Shortest distance"]},
        {"weeks": [49, 50], "topic": "Mathematical Reasoning & Statistics", "subtopics": ["Statements", "Logical connectives", "Mean median mode", "Standard deviation"]},
        {"weeks": [51, 52], "topic": "Revision & Problem Solving", "subtopics": ["Mixed problem sets", "PYQ practice", "Time management drills", "Full-length mocks"]}
    ]

    for week in range(1, 53):
        week_entry = {"week": week, "physics": None, "chemistry": None, "mathematics": None}
        
        p_topic = next((t for t in physics if week in t["weeks"]), None)
        if p_topic: week_entry["physics"] = {"topic": p_topic["topic"], "subtopics": p_topic["subtopics"]}
            
        c_topic = next((t for t in chemistry if week in t["weeks"]), None)
        if c_topic: week_entry["chemistry"] = {"topic": c_topic["topic"], "subtopics": c_topic["subtopics"]}
            
        m_topic = next((t for t in mathematics if week in t["weeks"]), None)
        if m_topic: week_entry["mathematics"] = {"topic": m_topic["topic"], "subtopics": m_topic["subtopics"]}
            
        schedule.append(week_entry)
        
    return schedule

def generate_test_calendar():
    return [
        {"week": 6, "name": "Phase Test 1", "type": "phase_test", "duration_minutes": 180, "total_marks": 300, "syllabus": {"physics": ["Units & Dimensions", "Kinematics 1D", "Kinematics 2D"], "chemistry": ["Basic Concepts", "Atomic Structure", "Chemical Bonding"], "mathematics": ["Sets & Relations", "Complex Numbers", "Quadratics"]}},
        {"week": 12, "name": "Phase Test 2", "type": "phase_test", "duration_minutes": 180, "total_marks": 300, "syllabus": {"physics": ["NLM", "Friction", "Work Energy Power"], "chemistry": ["States of Matter", "Thermodynamics", "Equilibrium"], "mathematics": ["Sequences", "Binomial", "PnC"]}},
        {"week": 18, "name": "Phase Test 3", "type": "phase_test", "duration_minutes": 180, "total_marks": 300, "syllabus": {"physics": ["COM & Collisions", "Rotational Mechanics", "Gravitation"], "chemistry": ["Ionic Equilibrium", "Redox & Electrochemistry", "Kinetics"], "mathematics": ["Probability", "Matrices", "Trigonometry"]}},
        {"week": 24, "name": "Phase Test 4 (Half-Yearly)", "type": "phase_test", "duration_minutes": 180, "total_marks": 300, "syllabus": {"physics": ["Fluid Mechanics", "SHM", "Waves"], "chemistry": ["Solutions", "Periodic Table", "s-Block"], "mathematics": ["Inverse Trig", "Triangles", "Limits & Continuity"]}},
        {"week": 26, "name": "Half-Yearly Examination", "type": "major_test", "duration_minutes": 180, "total_marks": 300, "syllabus": {"physics": ["Full Mechanics + Waves"], "chemistry": ["Full Physical + Half Inorganic"], "mathematics": ["Full Algebra + Trigonometry + Half Calculus"]}},
        {"week": 30, "name": "Phase Test 5", "type": "phase_test", "duration_minutes": 180, "total_marks": 300, "syllabus": {"physics": ["Calorimetry", "KTG", "Thermodynamics"], "chemistry": ["p-Block (13-14)", "p-Block (15-18)", "d-Block"], "mathematics": ["Differentiation", "Application of Derivatives", "Indefinite Integration"]}},
        {"week": 36, "name": "Phase Test 6", "type": "phase_test", "duration_minutes": 180, "total_marks": 300, "syllabus": {"physics": ["Ray Optics", "Wave Optics", "Electrostatics"], "chemistry": ["Coordination Compounds", "Metallurgy", "Basics of Organic"], "mathematics": ["Definite Integration", "Area Under Curves", "Differential Equations"]}},
        {"week": 40, "name": "Pre-Board Mock 1", "type": "mock_jee", "duration_minutes": 180, "total_marks": 300, "syllabus": {"physics": ["Complete Syllabus"], "chemistry": ["Complete Syllabus"], "mathematics": ["Complete Syllabus"]}},
        {"week": 42, "name": "Phase Test 7", "type": "phase_test", "duration_minutes": 180, "total_marks": 300, "syllabus": {"physics": ["Capacitance", "Current Electricity", "Magnetic Effects"], "chemistry": ["Hydrocarbons", "Alkyl Halides", "Alcohols & Phenols"], "mathematics": ["Straight Lines", "Circles", "Parabola"]}},
        {"week": 48, "name": "Phase Test 8", "type": "phase_test", "duration_minutes": 180, "total_marks": 300, "syllabus": {"physics": ["EMI", "AC Circuits", "Dual Nature"], "chemistry": ["Aldehydes & Ketones", "Amines", "Biomolecules"], "mathematics": ["Ellipse & Hyperbola", "Vectors", "3D Geometry"]}},
        {"week": 50, "name": "Pre-Board Mock 2", "type": "mock_jee", "duration_minutes": 180, "total_marks": 300, "syllabus": {"physics": ["Complete Syllabus"], "chemistry": ["Complete Syllabus"], "mathematics": ["Complete Syllabus"]}}
    ]

# Construct SQL script 
weekly = json.dumps(generate_weekly_schedule()).replace("'", "''")
tests = json.dumps(generate_test_calendar()).replace("'", "''")

sql = f"""
INSERT INTO coaching_templates (
  institute_name, program, year_level, description, weekly_schedule, test_calendar, total_weeks, is_active
) VALUES (
  'Standard JEE',
  'JEE',
  '11',
  'A standard JEE preparation roadmap following the typical coaching-center progression. Physics: Mechanics → Thermodynamics → Waves → Electro → Modern. Chemistry: Physical → Inorganic → Organic. Mathematics: Algebra → Calculus → Coordinate → Vectors.',
  '{weekly}'::jsonb,
  '{tests}'::jsonb,
  52,
  true
);
"""

with open('scripts/seed.sql', 'w') as f:
    f.write(sql)
    
print("Generated scripts/seed.sql")
