-- Global NCERT concept catalog used by teacher assignment flows.
-- The existing Course Engine hierarchy remains the source of truth:
-- courses -> syllabi -> chapters -> topics -> subtopics.

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS board TEXT,
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS source_version TEXT;

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS curriculum_items JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.assignments.curriculum_items IS
  'Teacher-selected curriculum concepts: [{topic_id, subtopic_id, topic, subtopic, chapter}].';

CREATE INDEX IF NOT EXISTS idx_courses_catalog_lookup
  ON public.courses (board, grade, lower(name))
  WHERE school_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_topics_name_lower
  ON public.topics (lower(name));

CREATE INDEX IF NOT EXISTS idx_subtopics_name_lower
  ON public.subtopics (lower(name));

DO $$
DECLARE
  v_course JSONB;
  v_chapter JSONB;
  v_topic JSONB;
  v_subtopic TEXT;
  v_course_id UUID;
  v_syllabus_id UUID;
  v_chapter_id UUID;
  v_topic_id UUID;
  v_chapter_order INT;
  v_topic_order INT;
  v_subtopic_order INT;
  v_catalog JSONB := $catalog$
  [
    {
      "grade":"Class 6","subject":"Mathematics","chapters":[
        {"name":"Patterns in Mathematics","topics":[{"name":"Number and shape patterns","subtopics":["Recognising patterns","Extending sequences","Visual patterns"]}]},
        {"name":"Lines and Angles","topics":[{"name":"Basic geometry","subtopics":["Points and lines","Rays and line segments","Angles and angle measurement"]}]},
        {"name":"Number Play","topics":[{"name":"Properties of numbers","subtopics":["Number patterns","Digit puzzles","Estimation strategies"]}]},
        {"name":"Data Handling and Presentation","topics":[{"name":"Representing data","subtopics":["Tally marks","Pictographs","Bar graphs","Interpreting data"]}]},
        {"name":"Prime Time","topics":[{"name":"Factors and multiples","subtopics":["Prime and composite numbers","Divisibility","Common factors and multiples"]}]},
        {"name":"Perimeter and Area","topics":[{"name":"Mensuration","subtopics":["Perimeter of polygons","Area of rectangles","Composite figures"]}]},
        {"name":"Fractions","topics":[{"name":"Fraction concepts","subtopics":["Equivalent fractions","Comparing fractions","Addition and subtraction of fractions"]}]},
        {"name":"Playing with Constructions","topics":[{"name":"Geometric constructions","subtopics":["Circles","Perpendiculars","Constructing shapes"]}]},
        {"name":"Symmetry","topics":[{"name":"Symmetry in shapes","subtopics":["Lines of symmetry","Rotational symmetry","Symmetric designs"]}]},
        {"name":"The Other Side of Zero","topics":[{"name":"Integers","subtopics":["Negative numbers","Number line","Operations with integers"]}]}
      ]
    },
    {
      "grade":"Class 6","subject":"Science","chapters":[
        {"name":"The Wonderful World of Science","topics":[{"name":"Scientific inquiry","subtopics":["Observation","Asking questions","Evidence and investigation"]}]},
        {"name":"Diversity in the Living World","topics":[{"name":"Living organisms","subtopics":["Plant diversity","Animal diversity","Grouping living things"]}]},
        {"name":"Mindful Eating: A Path to a Healthy Body","topics":[{"name":"Food and health","subtopics":["Nutrients","Balanced diet","Food choices"]}]},
        {"name":"Exploring Magnets","topics":[{"name":"Magnetism","subtopics":["Magnetic materials","Poles of a magnet","Compass and directions"]}]},
        {"name":"Measurement of Length and Motion","topics":[{"name":"Measurement and motion","subtopics":["Standard units","Measuring length","Types of motion"]}]},
        {"name":"Materials Around Us","topics":[{"name":"Properties of materials","subtopics":["Classification of materials","Solubility","Transparency and hardness"]}]},
        {"name":"Temperature and its Measurement","topics":[{"name":"Heat and temperature","subtopics":["Clinical thermometer","Laboratory thermometer","Reading temperature"]}]},
        {"name":"A Journey through States of Water","topics":[{"name":"States of matter","subtopics":["Evaporation","Condensation","Water cycle"]}]},
        {"name":"Methods of Separation in Everyday Life","topics":[{"name":"Separation techniques","subtopics":["Handpicking and sieving","Filtration","Evaporation"]}]},
        {"name":"Living Creatures: Exploring their Characteristics","topics":[{"name":"Characteristics of life","subtopics":["Growth and movement","Life cycles","Habitat and adaptation"]}]},
        {"name":"Nature's Treasures","topics":[{"name":"Natural resources","subtopics":["Air and water","Forests and soil","Conservation"]}]},
        {"name":"Beyond Earth","topics":[{"name":"The solar system","subtopics":["Sun and planets","Moon","Stars and constellations"]}]}
      ]
    },
    {
      "grade":"Class 7","subject":"Mathematics","chapters":[
        {"name":"Integers","topics":[{"name":"Operations on integers","subtopics":["Addition and subtraction","Multiplication and division","Properties of operations"]}]},
        {"name":"Fractions and Decimals","topics":[{"name":"Rational arithmetic","subtopics":["Multiplication of fractions","Division of fractions","Decimal operations"]}]},
        {"name":"Data Handling","topics":[{"name":"Working with data","subtopics":["Mean median and mode","Bar graphs","Probability introduction"]}]},
        {"name":"Simple Equations","topics":[{"name":"Linear equations","subtopics":["Forming equations","Solving one-step equations","Word problems"]}]},
        {"name":"Lines and Angles","topics":[{"name":"Angle relationships","subtopics":["Complementary and supplementary angles","Transversal lines","Parallel lines"]}]},
        {"name":"The Triangle and its Properties","topics":[{"name":"Triangles","subtopics":["Angle sum property","Exterior angle property","Pythagoras property"]}]},
        {"name":"Comparing Quantities","topics":[{"name":"Percentages","subtopics":["Percentage change","Profit and loss","Simple interest"]}]},
        {"name":"Rational Numbers","topics":[{"name":"Rational numbers","subtopics":["Standard form","Number line","Operations"]}]},
        {"name":"Perimeter and Area","topics":[{"name":"Mensuration","subtopics":["Area of triangles","Area of circles","Applications"]}]},
        {"name":"Algebraic Expressions","topics":[{"name":"Algebraic expressions","subtopics":["Terms and coefficients","Like terms","Addition and subtraction"]}]},
        {"name":"Exponents and Powers","topics":[{"name":"Exponents","subtopics":["Laws of exponents","Standard form","Large numbers"]}]},
        {"name":"Symmetry","topics":[{"name":"Lines of symmetry","subtopics":["Reflection symmetry","Rotational symmetry","Order of rotation"]}]},
        {"name":"Visualising Solid Shapes","topics":[{"name":"Three-dimensional shapes","subtopics":["Nets","Views of solids","Euler relationship"]}]}
      ]
    },
    {
      "grade":"Class 7","subject":"Science","chapters":[
        {"name":"Nutrition in Plants","topics":[{"name":"Plant nutrition","subtopics":["Photosynthesis","Other modes of nutrition","Nutrient replenishment"]}]},
        {"name":"Nutrition in Animals","topics":[{"name":"Animal nutrition","subtopics":["Human digestive system","Digestion in ruminants","Feeding in amoeba"]}]},
        {"name":"Heat","topics":[{"name":"Heat transfer","subtopics":["Temperature measurement","Conduction","Convection and radiation"]}]},
        {"name":"Acids, Bases and Salts","topics":[{"name":"Acids and bases","subtopics":["Indicators","Neutralisation","Everyday applications"]}]},
        {"name":"Physical and Chemical Changes","topics":[{"name":"Changes in matter","subtopics":["Physical changes","Chemical reactions","Crystallisation"]}]},
        {"name":"Respiration in Organisms","topics":[{"name":"Respiration","subtopics":["Aerobic and anaerobic respiration","Human breathing","Respiration in plants"]}]},
        {"name":"Transportation in Animals and Plants","topics":[{"name":"Transport systems","subtopics":["Circulatory system","Excretion","Transport in plants"]}]},
        {"name":"Reproduction in Plants","topics":[{"name":"Plant reproduction","subtopics":["Asexual reproduction","Sexual reproduction","Seed dispersal"]}]},
        {"name":"Motion and Time","topics":[{"name":"Motion","subtopics":["Speed","Distance-time graphs","Periodic motion"]}]},
        {"name":"Electric Current and its Effects","topics":[{"name":"Electricity","subtopics":["Electric circuits","Heating effect","Magnetic effect"]}]},
        {"name":"Light","topics":[{"name":"Optics","subtopics":["Reflection","Mirrors and lenses","Dispersion"]}]},
        {"name":"Forests: Our Lifeline","topics":[{"name":"Forest ecosystems","subtopics":["Food chains","Decomposers","Conservation"]}]},
        {"name":"Wastewater Story","topics":[{"name":"Water sanitation","subtopics":["Sewage treatment","Sanitation","Water conservation"]}]}
      ]
    },
    {
      "grade":"Class 8","subject":"Mathematics","chapters":[
        {"name":"Rational Numbers","topics":[{"name":"Properties of rational numbers","subtopics":["Closure and commutativity","Associativity","Distributive property"]}]},
        {"name":"Linear Equations in One Variable","topics":[{"name":"Linear equations","subtopics":["Equations with variables on both sides","Reducible equations","Applications"]}]},
        {"name":"Understanding Quadrilaterals","topics":[{"name":"Polygons and quadrilaterals","subtopics":["Angle sum property","Types of quadrilaterals","Exterior angles"]}]},
        {"name":"Data Handling","topics":[{"name":"Data and probability","subtopics":["Pie charts","Grouped data","Probability"]}]},
        {"name":"Squares and Square Roots","topics":[{"name":"Squares","subtopics":["Perfect squares","Square roots","Estimating roots"]}]},
        {"name":"Cubes and Cube Roots","topics":[{"name":"Cubes","subtopics":["Perfect cubes","Cube roots","Prime factorisation"]}]},
        {"name":"Comparing Quantities","topics":[{"name":"Commercial arithmetic","subtopics":["Discount","Compound interest","Taxes"]}]},
        {"name":"Algebraic Expressions and Identities","topics":[{"name":"Algebraic identities","subtopics":["Multiplication of expressions","Standard identities","Applications"]}]},
        {"name":"Mensuration","topics":[{"name":"Surface area and volume","subtopics":["Trapezium area","Surface area","Volume"]}]},
        {"name":"Exponents and Powers","topics":[{"name":"Powers","subtopics":["Negative exponents","Laws of exponents","Standard form"]}]},
        {"name":"Direct and Inverse Proportions","topics":[{"name":"Proportion","subtopics":["Direct proportion","Inverse proportion","Applications"]}]},
        {"name":"Factorisation","topics":[{"name":"Factorisation","subtopics":["Common factors","Factorisation by identities","Division of expressions"]}]},
        {"name":"Introduction to Graphs","topics":[{"name":"Graphs","subtopics":["Coordinates","Line graphs","Linear graphs"]}]}
      ]
    },
    {
      "grade":"Class 8","subject":"Science","chapters":[
        {"name":"Crop Production and Management","topics":[{"name":"Agriculture","subtopics":["Crop practices","Irrigation","Storage"]}]},
        {"name":"Microorganisms: Friend and Foe","topics":[{"name":"Microorganisms","subtopics":["Useful microorganisms","Diseases","Nitrogen cycle"]}]},
        {"name":"Coal and Petroleum","topics":[{"name":"Fossil fuels","subtopics":["Formation","Products","Conservation"]}]},
        {"name":"Combustion and Flame","topics":[{"name":"Combustion","subtopics":["Types of combustion","Flame structure","Fuel efficiency"]}]},
        {"name":"Conservation of Plants and Animals","topics":[{"name":"Biodiversity conservation","subtopics":["Deforestation","Protected areas","Endangered species"]}]},
        {"name":"Reproduction in Animals","topics":[{"name":"Animal reproduction","subtopics":["Fertilisation","Development","Asexual reproduction"]}]},
        {"name":"Reaching the Age of Adolescence","topics":[{"name":"Adolescence","subtopics":["Hormones","Puberty","Reproductive health"]}]},
        {"name":"Force and Pressure","topics":[{"name":"Force","subtopics":["Contact and non-contact forces","Pressure","Atmospheric pressure"]}]},
        {"name":"Friction","topics":[{"name":"Friction","subtopics":["Factors affecting friction","Increasing and reducing friction","Fluid friction"]}]},
        {"name":"Sound","topics":[{"name":"Sound","subtopics":["Vibration","Human voice and ear","Noise pollution"]}]},
        {"name":"Chemical Effects of Electric Current","topics":[{"name":"Electrochemistry basics","subtopics":["Conducting liquids","Electroplating","Chemical effects"]}]},
        {"name":"Some Natural Phenomena","topics":[{"name":"Lightning and earthquakes","subtopics":["Electric charges","Lightning safety","Earthquake safety"]}]},
        {"name":"Light","topics":[{"name":"Reflection of light","subtopics":["Laws of reflection","Multiple reflection","Human eye"]}]}
      ]
    },
    {
      "grade":"Class 9","subject":"Mathematics","chapters":[
        {"name":"Number Systems","topics":[{"name":"Real numbers","subtopics":["Irrational numbers","Real number line","Laws of exponents"]}]},
        {"name":"Polynomials","topics":[{"name":"Polynomials","subtopics":["Zeros","Remainder theorem","Factorisation identities"]}]},
        {"name":"Coordinate Geometry","topics":[{"name":"Cartesian plane","subtopics":["Coordinates","Quadrants","Plotting points"]}]},
        {"name":"Linear Equations in Two Variables","topics":[{"name":"Two-variable equations","subtopics":["Solution pairs","Graphs","Applications"]}]},
        {"name":"Introduction to Euclid's Geometry","topics":[{"name":"Euclidean geometry","subtopics":["Axioms and postulates","Definitions","Equivalent versions"]}]},
        {"name":"Lines and Angles","topics":[{"name":"Angle theorems","subtopics":["Intersecting lines","Parallel lines","Triangle angle properties"]}]},
        {"name":"Triangles","topics":[{"name":"Triangle congruence","subtopics":["Congruence criteria","Inequalities","Properties"]}]},
        {"name":"Quadrilaterals","topics":[{"name":"Quadrilaterals","subtopics":["Parallelogram properties","Mid-point theorem","Angle properties"]}]},
        {"name":"Circles","topics":[{"name":"Circle theorems","subtopics":["Chords","Angles subtended","Cyclic quadrilaterals"]}]},
        {"name":"Heron's Formula","topics":[{"name":"Area by Heron's formula","subtopics":["Triangle area","Quadrilateral area","Applications"]}]},
        {"name":"Surface Areas and Volumes","topics":[{"name":"Solid mensuration","subtopics":["Cone","Sphere","Combined solids"]}]},
        {"name":"Statistics","topics":[{"name":"Descriptive statistics","subtopics":["Data presentation","Histograms","Measures of central tendency"]}]}
      ]
    },
    {
      "grade":"Class 9","subject":"Science","chapters":[
        {"name":"Matter in Our Surroundings","topics":[{"name":"States of matter","subtopics":["Particle nature","Change of state","Evaporation"]}]},
        {"name":"Is Matter Around Us Pure?","topics":[{"name":"Mixtures and solutions","subtopics":["Types of mixtures","Separation methods","Physical and chemical changes"]}]},
        {"name":"Atoms and Molecules","topics":[{"name":"Atomic theory","subtopics":["Laws of chemical combination","Mole concept","Chemical formulae"]}]},
        {"name":"Structure of the Atom","topics":[{"name":"Atomic structure","subtopics":["Subatomic particles","Atomic models","Isotopes and isobars"]}]},
        {"name":"The Fundamental Unit of Life","topics":[{"name":"Cell biology","subtopics":["Cell membrane","Cell organelles","Plant and animal cells"]}]},
        {"name":"Tissues","topics":[{"name":"Plant and animal tissues","subtopics":["Meristematic tissues","Permanent tissues","Animal tissues"]}]},
        {"name":"Motion","topics":[{"name":"Kinematics","subtopics":["Distance and displacement","Velocity and acceleration","Motion graphs"]}]},
        {"name":"Force and Laws of Motion","topics":[{"name":"Newton's laws","subtopics":["Inertia","Momentum","Conservation of momentum"]}]},
        {"name":"Gravitation","topics":[{"name":"Gravity","subtopics":["Universal law","Free fall","Buoyancy"]}]},
        {"name":"Work and Energy","topics":[{"name":"Work energy and power","subtopics":["Kinetic energy","Potential energy","Conservation of energy"]}]},
        {"name":"Sound","topics":[{"name":"Sound waves","subtopics":["Wave characteristics","Reflection of sound","Human ear"]}]},
        {"name":"Improvement in Food Resources","topics":[{"name":"Food production","subtopics":["Crop improvement","Animal husbandry","Sustainable practices"]}]}
      ]
    },
    {
      "grade":"Class 10","subject":"Mathematics","chapters":[
        {"name":"Real Numbers","topics":[{"name":"Number theory","subtopics":["Fundamental theorem of arithmetic","HCF and LCM","Irrationality"]}]},
        {"name":"Polynomials","topics":[{"name":"Zeros of polynomials","subtopics":["Geometrical meaning of zeros","Relationship with coefficients","Cubic polynomials"]}]},
        {"name":"Pair of Linear Equations in Two Variables","topics":[{"name":"Simultaneous equations","subtopics":["Graphical method","Substitution and elimination","Consistency"]}]},
        {"name":"Quadratic Equations","topics":[{"name":"Quadratics","subtopics":["Factorisation","Quadratic formula","Nature of roots"]}]},
        {"name":"Arithmetic Progressions","topics":[{"name":"Arithmetic progressions","subtopics":["Nth term","Sum of terms","Applications"]}]},
        {"name":"Triangles","topics":[{"name":"Similarity","subtopics":["Similarity criteria","Basic proportionality theorem","Area ratios"]}]},
        {"name":"Coordinate Geometry","topics":[{"name":"Coordinate methods","subtopics":["Distance formula","Section formula","Area of triangle"]}]},
        {"name":"Introduction to Trigonometry","topics":[{"name":"Trigonometric ratios","subtopics":["Ratios of acute angles","Standard angles","Identities"]}]},
        {"name":"Applications of Trigonometry","topics":[{"name":"Heights and distances","subtopics":["Angle of elevation","Angle of depression","Applications"]}]},
        {"name":"Circles","topics":[{"name":"Tangents","subtopics":["Tangent properties","Tangents from an external point","Proofs"]}]},
        {"name":"Areas Related to Circles","topics":[{"name":"Circle mensuration","subtopics":["Sector area","Segment area","Combined figures"]}]},
        {"name":"Surface Areas and Volumes","topics":[{"name":"Combined solids","subtopics":["Surface area","Volume conversion","Frustum"]}]},
        {"name":"Statistics","topics":[{"name":"Grouped data","subtopics":["Mean","Median","Mode"]}]},
        {"name":"Probability","topics":[{"name":"Classical probability","subtopics":["Events","Complementary events","Simple problems"]}]}
      ]
    },
    {
      "grade":"Class 10","subject":"Science","chapters":[
        {"name":"Chemical Reactions and Equations","topics":[{"name":"Chemical reactions","subtopics":["Balancing equations","Types of reactions","Oxidation and reduction"]}]},
        {"name":"Acids, Bases and Salts","topics":[{"name":"Acids bases and salts","subtopics":["pH scale","Chemical properties","Common salts"]}]},
        {"name":"Metals and Non-metals","topics":[{"name":"Metals and non-metals","subtopics":["Reactivity series","Ionic compounds","Metallurgy"]}]},
        {"name":"Carbon and its Compounds","topics":[{"name":"Organic chemistry basics","subtopics":["Covalent bonding","Homologous series","Ethanol and ethanoic acid"]}]},
        {"name":"Life Processes","topics":[{"name":"Life processes","subtopics":["Nutrition","Respiration","Transportation and excretion"]}]},
        {"name":"Control and Coordination","topics":[{"name":"Control systems","subtopics":["Nervous system","Hormones","Plant coordination"]}]},
        {"name":"How do Organisms Reproduce?","topics":[{"name":"Reproduction","subtopics":["Asexual reproduction","Sexual reproduction","Reproductive health"]}]},
        {"name":"Heredity","topics":[{"name":"Heredity and evolution","subtopics":["Mendel's laws","Sex determination","Variation"]}]},
        {"name":"Light: Reflection and Refraction","topics":[{"name":"Geometrical optics","subtopics":["Spherical mirrors","Refraction","Lenses"]}]},
        {"name":"The Human Eye and the Colourful World","topics":[{"name":"Human eye and atmosphere","subtopics":["Defects of vision","Dispersion","Atmospheric refraction"]}]},
        {"name":"Electricity","topics":[{"name":"Electric circuits","subtopics":["Ohm's law","Resistance combinations","Electric power"]}]},
        {"name":"Magnetic Effects of Electric Current","topics":[{"name":"Electromagnetism","subtopics":["Magnetic field","Force on conductor","Electric motor and generator"]}]},
        {"name":"Our Environment","topics":[{"name":"Ecosystems","subtopics":["Food chains","Biodegradable materials","Ozone layer"]}]}
      ]
    }
  ]
  $catalog$::jsonb;
BEGIN
  FOR v_course IN SELECT value FROM jsonb_array_elements(v_catalog)
  LOOP
    v_course_id := md5(
      'ncert|' || (v_course->>'grade') || '|' || lower(v_course->>'subject')
    )::uuid;
    v_syllabus_id := md5(
      'ncert-syllabus|' || (v_course->>'grade') || '|' || lower(v_course->>'subject')
    )::uuid;

    INSERT INTO public.courses (
      id, school_id, name, grade, description, board, source_url, source_version
    ) VALUES (
      v_course_id,
      NULL,
      v_course->>'subject',
      v_course->>'grade',
      'NCERT-aligned concept catalog for teacher planning and assignments.',
      'NCERT',
      'https://ncert.nic.in/textbook.php',
      '2026-27'
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      grade = EXCLUDED.grade,
      board = EXCLUDED.board,
      source_url = EXCLUDED.source_url,
      source_version = EXCLUDED.source_version;

    INSERT INTO public.syllabi (id, course_id, version, is_active)
    VALUES (v_syllabus_id, v_course_id, 202627, TRUE)
    ON CONFLICT (id) DO UPDATE SET is_active = TRUE;

    v_chapter_order := 0;
    FOR v_chapter IN SELECT value FROM jsonb_array_elements(v_course->'chapters')
    LOOP
      v_chapter_order := v_chapter_order + 1;
      v_chapter_id := md5(v_syllabus_id::text || '|chapter|' || lower(v_chapter->>'name'))::uuid;
      INSERT INTO public.chapters (id, syllabus_id, name, sequence_order)
      VALUES (v_chapter_id, v_syllabus_id, v_chapter->>'name', v_chapter_order)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        sequence_order = EXCLUDED.sequence_order;

      v_topic_order := 0;
      FOR v_topic IN SELECT value FROM jsonb_array_elements(v_chapter->'topics')
      LOOP
        v_topic_order := v_topic_order + 1;
        v_topic_id := md5(v_chapter_id::text || '|topic|' || lower(v_topic->>'name'))::uuid;
        INSERT INTO public.topics (id, chapter_id, name, sequence_order)
        VALUES (v_topic_id, v_chapter_id, v_topic->>'name', v_topic_order)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          sequence_order = EXCLUDED.sequence_order;

        v_subtopic_order := 0;
        FOR v_subtopic IN SELECT value #>> '{}' FROM jsonb_array_elements(v_topic->'subtopics')
        LOOP
          v_subtopic_order := v_subtopic_order + 1;
          INSERT INTO public.subtopics (id, topic_id, name, sequence_order)
          VALUES (
            md5(v_topic_id::text || '|subtopic|' || lower(v_subtopic))::uuid,
            v_topic_id,
            v_subtopic,
            v_subtopic_order
          )
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            sequence_order = EXCLUDED.sequence_order;
        END LOOP;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;
