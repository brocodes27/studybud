-- Expand the NCERT catalog:
-- Grades 6-10: Mathematics, Science, Social Science, English, Hindi
-- Grades 11-12: Physics, Chemistry, Mathematics, Biology (PCM / PCB)
--
-- Mathematics and Science for Grades 6-10 are seeded by the preceding
-- 20260713160000 migration. This migration adds the remaining courses.

DO $seed$
DECLARE
  v_course JSONB;
  v_unit JSONB;
  v_subtopic TEXT;
  v_course_id UUID;
  v_syllabus_id UUID;
  v_chapter_id UUID;
  v_topic_id UUID;
  v_unit_order INT;
  v_subtopic_order INT;
  v_catalog JSONB := $catalog$
  [
    {"grade":"Class 6","subject":"Social Science","units":[
      {"name":"Locating Places on the Earth","subtopics":["Maps and globes","Latitudes and longitudes","Coordinates and scale"]},
      {"name":"Oceans and Continents","subtopics":["Continents","Oceans","Northern and Southern hemispheres"]},
      {"name":"Landforms and Life","subtopics":["Mountains","Plateaus","Plains and human life"]},
      {"name":"Timeline and Sources of History","subtopics":["Chronology","Archaeological sources","Literary and oral sources"]},
      {"name":"India, That Is Bharat","subtopics":["Names of India","Indian subcontinent","Historical geography"]},
      {"name":"The Beginnings of Indian Civilisation","subtopics":["Harappan cities","Trade and crafts","Decline and legacy"]},
      {"name":"India's Cultural Roots","subtopics":["Vedas","Buddhism and Jainism","Folk and tribal traditions"]},
      {"name":"Unity in Diversity","subtopics":["Cultural diversity","Shared traditions","Indian identity"]},
      {"name":"Family and Community","subtopics":["Family roles","Community life","Cooperation and responsibility"]},
      {"name":"Grassroots Democracy","subtopics":["Governance","Participation","Three levels of government"]},
      {"name":"Local Government in Rural Areas","subtopics":["Gram Sabha","Panchayati Raj","Local participation"]},
      {"name":"Local Government in Urban Areas","subtopics":["Municipalities","Urban services","Citizen participation"]},
      {"name":"The Value of Work","subtopics":["Economic and non-economic work","Dignity of labour","Community service"]},
      {"name":"Economic Activities Around Us","subtopics":["Primary activities","Secondary activities","Tertiary activities"]}
    ]},
    {"grade":"Class 7","subject":"Social Science","units":[
      {"name":"Geographical Diversity of India","subtopics":["Physical divisions","Regional diversity","People and landscapes"]},
      {"name":"Understanding the Weather","subtopics":["Elements of weather","Weather instruments","Forecasting"]},
      {"name":"Climates of India","subtopics":["Monsoon","Seasons","Regional climate"]},
      {"name":"New Beginnings: Cities and States","subtopics":["Second urbanisation","Janapadas","Early states"]},
      {"name":"The Rise of Empires","subtopics":["Mauryan Empire","Administration","Ashoka"]},
      {"name":"The Age of Reorganisation","subtopics":["Regional kingdoms","Trade networks","Political change"]},
      {"name":"The Gupta Era","subtopics":["Governance","Science and arts","Literature and society"]},
      {"name":"How the Land Becomes Sacred","subtopics":["Sacred geography","Pilgrimage","Cultural landscapes"]},
      {"name":"From the Rulers to the Ruled","subtopics":["Forms of government","Democracy","Citizenship"]},
      {"name":"The Constitution of India","subtopics":["Constitutional values","Rights and duties","Institutions"]},
      {"name":"From Barter to Money","subtopics":["Barter","Functions of money","Evolution of currency"]},
      {"name":"Understanding Markets","subtopics":["Types of markets","Supply chains","Consumers and producers"]}
    ]},
    {"grade":"Class 8","subject":"Social Science","units":[
      {"name":"How, When and Where","subtopics":["Periodisation","Colonial records","Sources of modern history"]},
      {"name":"From Trade to Territory","subtopics":["East India Company","Expansion of rule","Battle of Plassey"]},
      {"name":"Ruling the Countryside","subtopics":["Land revenue systems","Permanent Settlement","Peasant resistance"]},
      {"name":"Tribals, Dikus and the Vision of a Golden Age","subtopics":["Tribal livelihoods","Colonial forest laws","Birsa Munda"]},
      {"name":"When People Rebel: 1857 and After","subtopics":["Causes of revolt","Centres and leaders","Consequences"]},
      {"name":"Women, Caste and Reform","subtopics":["Social reform","Education","Caste movements"]},
      {"name":"The Making of the National Movement","subtopics":["Early nationalism","Mass movements","Independence"]},
      {"name":"Resources","subtopics":["Types of resources","Sustainable development","Conservation"]},
      {"name":"Land, Soil, Water, Natural Vegetation and Wildlife","subtopics":["Land use","Soil conservation","Water and biodiversity"]},
      {"name":"Agriculture","subtopics":["Types of farming","Major crops","Agricultural development"]},
      {"name":"Industries","subtopics":["Classification","Location factors","Industrial systems"]},
      {"name":"The Indian Constitution","subtopics":["Key features","Fundamental rights","Federalism"]},
      {"name":"Understanding Secularism","subtopics":["Secular state","Religious freedom","Indian secularism"]},
      {"name":"Parliament and the Making of Laws","subtopics":["Representation","Parliament","Legislative process"]},
      {"name":"Judiciary","subtopics":["Independent judiciary","Court structure","Access to justice"]},
      {"name":"Public Facilities and Social Justice","subtopics":["Public services","Equality","Law and social justice"]}
    ]},
    {"grade":"Class 9","subject":"Social Science","units":[
      {"name":"The French Revolution","subtopics":["Old Regime","Revolution and republic","Rights and legacy"]},
      {"name":"Socialism in Europe and the Russian Revolution","subtopics":["Socialist ideas","Russian Revolution","Soviet transformation"]},
      {"name":"Nazism and the Rise of Hitler","subtopics":["Weimar Republic","Nazi ideology","Holocaust"]},
      {"name":"Forest Society and Colonialism","subtopics":["Scientific forestry","Forest communities","Resistance"]},
      {"name":"India: Size and Location","subtopics":["Location","Standard meridian","Strategic significance"]},
      {"name":"Physical Features of India","subtopics":["Himalayas","Northern plains","Peninsular plateau and coasts"]},
      {"name":"Drainage","subtopics":["Himalayan rivers","Peninsular rivers","Lakes and conservation"]},
      {"name":"Climate","subtopics":["Monsoon mechanism","Seasons","Rainfall distribution"]},
      {"name":"Natural Vegetation and Wildlife","subtopics":["Vegetation types","Wildlife","Conservation"]},
      {"name":"Population","subtopics":["Distribution","Population change","Occupational structure"]},
      {"name":"What Is Democracy? Why Democracy?","subtopics":["Features of democracy","Arguments for democracy","Broader meanings"]},
      {"name":"Constitutional Design","subtopics":["South Africa","Making of Indian Constitution","Constitutional values"]},
      {"name":"Electoral Politics","subtopics":["Elections","Political competition","Election Commission"]},
      {"name":"Working of Institutions","subtopics":["Parliament","Executive","Judiciary"]},
      {"name":"Democratic Rights","subtopics":["Fundamental rights","Rights expansion","Human rights"]},
      {"name":"The Story of Village Palampur","subtopics":["Factors of production","Farming","Non-farm activities"]},
      {"name":"People as Resource","subtopics":["Human capital","Education and health","Unemployment"]},
      {"name":"Poverty as a Challenge","subtopics":["Poverty line","Vulnerable groups","Anti-poverty measures"]},
      {"name":"Food Security in India","subtopics":["Food security","Buffer stock","Public distribution system"]}
    ]},
    {"grade":"Class 10","subject":"Social Science","units":[
      {"name":"The Rise of Nationalism in Europe","subtopics":["French Revolution and nationalism","Nation states","Germany and Italy"]},
      {"name":"Nationalism in India","subtopics":["First World War","Non-Cooperation","Civil Disobedience"]},
      {"name":"The Making of a Global World","subtopics":["Pre-modern trade","Industrial era","Interwar economy"]},
      {"name":"The Age of Industrialisation","subtopics":["Proto-industrialisation","Factories","Industrial growth in India"]},
      {"name":"Print Culture and the Modern World","subtopics":["Print revolution","Public debate","Print in India"]},
      {"name":"Resources and Development","subtopics":["Resource planning","Land resources","Soil conservation"]},
      {"name":"Forest and Wildlife Resources","subtopics":["Biodiversity","Conservation","Community participation"]},
      {"name":"Water Resources","subtopics":["Multipurpose projects","Water scarcity","Rainwater harvesting"]},
      {"name":"Agriculture","subtopics":["Cropping patterns","Major crops","Agricultural reforms"]},
      {"name":"Minerals and Energy Resources","subtopics":["Mineral types","Conventional energy","Renewable energy"]},
      {"name":"Manufacturing Industries","subtopics":["Industrial location","Major industries","Pollution control"]},
      {"name":"Lifelines of National Economy","subtopics":["Transport","Communication","International trade"]},
      {"name":"Power Sharing","subtopics":["Belgium and Sri Lanka","Forms of power sharing","Democratic value"]},
      {"name":"Federalism","subtopics":["Federal features","Indian federalism","Decentralisation"]},
      {"name":"Gender, Religion and Caste","subtopics":["Gender division","Communalism","Caste and politics"]},
      {"name":"Political Parties","subtopics":["Functions","Party systems","Challenges and reforms"]},
      {"name":"Outcomes of Democracy","subtopics":["Accountability","Economic outcomes","Dignity and freedom"]},
      {"name":"Development","subtopics":["Development goals","Income and other criteria","Sustainability"]},
      {"name":"Sectors of the Indian Economy","subtopics":["Primary secondary tertiary","Organised and unorganised","Public and private"]},
      {"name":"Money and Credit","subtopics":["Money","Formal and informal credit","Self-help groups"]},
      {"name":"Globalisation and the Indian Economy","subtopics":["Multinational companies","Production networks","Trade liberalisation"]},
      {"name":"Consumer Rights","subtopics":["Consumer movement","Rights and responsibilities","Redressal"]}
    ]},

    {"grade":"Class 6","subject":"English","units":[
      {"name":"Fables and Folk Tales","subtopics":["A Bottle of Dew","The Raven and the Fox","Rama to the Rescue"]},
      {"name":"Friendship","subtopics":["The Unlikely Best Friends","A Friend's Prayer","The Chair"]},
      {"name":"Nurturing Nature","subtopics":["Neem Baba","What a Bird Thought","Spices that Heal Us"]},
      {"name":"Sports and Wellness","subtopics":["Change of Heart","The Winner","Yoga: A Way of Life"]},
      {"name":"Culture and Tradition","subtopics":["Hamara Bharat","The Kites","Ila Sachani","National War Memorial"]},
      {"name":"English Language Skills","subtopics":["Reading comprehension","Grammar and vocabulary","Creative writing"]}
    ]},
    {"grade":"Class 7","subject":"English","units":[
      {"name":"Three Questions","subtopics":["Reading comprehension","Theme and inference","Vocabulary"]},
      {"name":"A Gift of Chappals","subtopics":["Character and plot","Dialogue","Values"]},
      {"name":"Gopal and the Hilsa Fish","subtopics":["Humour","Visual narrative","Sequencing"]},
      {"name":"The Ashes That Made Trees Bloom","subtopics":["Folk tale","Cause and effect","Moral"]},
      {"name":"Quality","subtopics":["Characterisation","Craft and dignity","Inference"]},
      {"name":"Expert Detectives","subtopics":["Mystery","Point of view","Evidence"]},
      {"name":"The Invention of Vita-Wonk","subtopics":["Fantasy","Word play","Creative writing"]},
      {"name":"English Language Skills","subtopics":["Reading comprehension","Grammar and vocabulary","Writing"]}
    ]},
    {"grade":"Class 8","subject":"English","units":[
      {"name":"The Best Christmas Present in the World","subtopics":["Narrative","War and peace","Letter writing"]},
      {"name":"The Tsunami","subtopics":["Multiple accounts","Disaster awareness","Inference"]},
      {"name":"Glimpses of the Past","subtopics":["Visual text","Historical narrative","Sequencing"]},
      {"name":"Bepin Choudhury's Lapse of Memory","subtopics":["Humour","Plot twist","Character"]},
      {"name":"The Summit Within","subtopics":["Adventure","Metaphor","Reflection"]},
      {"name":"This is Jody's Fawn","subtopics":["Empathy","Dialogue","Character motivation"]},
      {"name":"A Visit to Cambridge","subtopics":["Interview","Disability and resilience","Reported speech"]},
      {"name":"A Short Monsoon Diary","subtopics":["Diary writing","Nature description","Imagery"]},
      {"name":"English Language Skills","subtopics":["Reading comprehension","Grammar and vocabulary","Writing"]}
    ]},
    {"grade":"Class 9","subject":"English","units":[
      {"name":"The Fun They Had","subtopics":["Science fiction","Education","Compare and contrast"]},
      {"name":"The Sound of Music","subtopics":["Biography","Perseverance","Profile writing"]},
      {"name":"The Little Girl","subtopics":["Character development","Family relationships","Inference"]},
      {"name":"A Truly Beautiful Mind","subtopics":["Biography","Ideas and values","Chronology"]},
      {"name":"The Snake and the Mirror","subtopics":["Humour","Narration","Irony"]},
      {"name":"My Childhood","subtopics":["Autobiography","Social harmony","Reflection"]},
      {"name":"Reach for the Top","subtopics":["Biography","Achievement","Comparison"]},
      {"name":"Kathmandu","subtopics":["Travel writing","Description","Cultural observation"]},
      {"name":"If I Were You","subtopics":["Drama","Dialogue","Presence of mind"]},
      {"name":"Poetry and Supplementary Reader","subtopics":["Poetic devices","Theme and tone","Moments stories"]},
      {"name":"English Language Skills","subtopics":["Reading comprehension","Grammar","Descriptive and story writing"]}
    ]},
    {"grade":"Class 10","subject":"English","units":[
      {"name":"A Letter to God","subtopics":["Faith and irony","Character","Letter writing"]},
      {"name":"Nelson Mandela: Long Walk to Freedom","subtopics":["Autobiography","Freedom and courage","Speech analysis"]},
      {"name":"Two Stories about Flying","subtopics":["Fear and confidence","Narrative","Inference"]},
      {"name":"From the Diary of Anne Frank","subtopics":["Diary writing","War and identity","Reflection"]},
      {"name":"Glimpses of India","subtopics":["Travel and culture","Description","Regional diversity"]},
      {"name":"Mijbil the Otter","subtopics":["Human-animal bond","Travel narrative","Observation"]},
      {"name":"Madam Rides the Bus","subtopics":["Character","Independence","Journey narrative"]},
      {"name":"The Sermon at Benares","subtopics":["Buddha's teaching","Mortality","Parable"]},
      {"name":"The Proposal","subtopics":["Drama","Satire","Dialogue"]},
      {"name":"Poetry and Supplementary Reader","subtopics":["Poetic devices","Theme and tone","Footprints Without Feet stories"]},
      {"name":"English Language Skills","subtopics":["Reading comprehension","Grammar","Analytical writing"]}
    ]},

    {"grade":"Class 6","subject":"Hindi","units":[
      {"name":"मल्हार — गद्य","subtopics":["कहानी","संस्मरण","निबंध और संवाद"]},
      {"name":"मल्हार — पद्य","subtopics":["कविता का भावार्थ","लय और तुक","काव्य सौंदर्य"]},
      {"name":"पठन कौशल","subtopics":["अपठित गद्यांश","अपठित पद्यांश","शब्दार्थ और निष्कर्ष"]},
      {"name":"हिंदी व्याकरण","subtopics":["संज्ञा और सर्वनाम","विशेषण और क्रिया","वाक्य और विराम चिह्न"]},
      {"name":"रचनात्मक लेखन","subtopics":["अनुच्छेद","पत्र","संवाद और चित्र-वर्णन"]}
    ]},
    {"grade":"Class 7","subject":"Hindi","units":[
      {"name":"वसंत — गद्य","subtopics":["कहानी","निबंध","संस्मरण"]},
      {"name":"वसंत — पद्य","subtopics":["भावार्थ","काव्य-भाषा","काव्य सौंदर्य"]},
      {"name":"पठन कौशल","subtopics":["अपठित गद्यांश","अपठित पद्यांश","निष्कर्ष"]},
      {"name":"हिंदी व्याकरण","subtopics":["शब्द-विचार","संधि और समास","काल और वाक्य"]},
      {"name":"रचनात्मक लेखन","subtopics":["अनुच्छेद","पत्र","संवाद और कहानी"]}
    ]},
    {"grade":"Class 8","subject":"Hindi","units":[
      {"name":"वसंत — गद्य","subtopics":["कहानी","निबंध","व्यंग्य और संस्मरण"]},
      {"name":"वसंत — पद्य","subtopics":["भावार्थ","अलंकार","काव्य सौंदर्य"]},
      {"name":"भारत की खोज","subtopics":["भारतीय इतिहास","संस्कृति","राष्ट्रीय चेतना"]},
      {"name":"हिंदी व्याकरण","subtopics":["उपसर्ग और प्रत्यय","संधि और समास","वाच्य और वाक्य"]},
      {"name":"रचनात्मक लेखन","subtopics":["अनुच्छेद","औपचारिक पत्र","विज्ञापन और संवाद"]}
    ]},
    {"grade":"Class 9","subject":"Hindi","units":[
      {"name":"क्षितिज / स्पर्श — गद्य","subtopics":["कहानी","निबंध","व्यंग्य और संस्मरण"]},
      {"name":"क्षितिज / स्पर्श — पद्य","subtopics":["काव्य भाव","अलंकार","शिल्प और भाषा"]},
      {"name":"कृतिका / संचयन","subtopics":["पूरक पठन","चरित्र-चित्रण","विषय-वस्तु"]},
      {"name":"हिंदी व्याकरण","subtopics":["शब्द और पद","समास","वाक्य-भेद और अलंकार"]},
      {"name":"रचनात्मक लेखन","subtopics":["अनुच्छेद","पत्र और ईमेल","संवाद और सूचना"]}
    ]},
    {"grade":"Class 10","subject":"Hindi","units":[
      {"name":"क्षितिज / स्पर्श — गद्य","subtopics":["कहानी","निबंध","व्यंग्य और संस्मरण"]},
      {"name":"क्षितिज / स्पर्श — पद्य","subtopics":["काव्य भाव","अलंकार","शिल्प और भाषा"]},
      {"name":"कृतिका / संचयन","subtopics":["पूरक पठन","चरित्र-चित्रण","आलोचनात्मक विवेचन"]},
      {"name":"हिंदी व्याकरण","subtopics":["पदबंध","समास","वाक्य रूपांतरण और अलंकार"]},
      {"name":"रचनात्मक लेखन","subtopics":["अनुच्छेद","औपचारिक पत्र","विज्ञापन संदेश और ईमेल"]}
    ]},
    {"grade":"Class 6","subject":"Sanskrit","units":[
      {"name":"दीपकम् — गद्य एवं संवाद","subtopics":["सरल गद्य-बोध","संवाद","शब्दार्थ"]},
      {"name":"दीपकम् — पद्य","subtopics":["श्लोक-पाठ","भावार्थ","सुभाषित"]},
      {"name":"संस्कृत व्याकरण","subtopics":["शब्दरूप","धातुरूप","लकार और विभक्ति"]},
      {"name":"रचनात्मक कार्य","subtopics":["चित्र-वर्णन","सरल वाक्य","संवाद-लेखन"]}
    ]},
    {"grade":"Class 7","subject":"Sanskrit","units":[
      {"name":"रुचिरा — गद्य","subtopics":["गद्य-बोध","कथा","संवाद"]},
      {"name":"रुचिरा — पद्य","subtopics":["श्लोक","भावार्थ","नीतिवचन"]},
      {"name":"संस्कृत व्याकरण","subtopics":["शब्दरूप","धातुरूप","संधि और कारक"]},
      {"name":"रचनात्मक कार्य","subtopics":["चित्र-वर्णन","पत्र","अनुच्छेद"]}
    ]},
    {"grade":"Class 8","subject":"Sanskrit","units":[
      {"name":"रुचिरा — गद्य","subtopics":["गद्य-बोध","कथा-विवेचन","संवाद"]},
      {"name":"रुचिरा — पद्य","subtopics":["श्लोक","भावार्थ","काव्य-सौंदर्य"]},
      {"name":"संस्कृत व्याकरण","subtopics":["संधि","समास","प्रत्यय और लकार"]},
      {"name":"रचनात्मक कार्य","subtopics":["चित्र-वर्णन","पत्र","अनुच्छेद"]}
    ]},
    {"grade":"Class 9","subject":"Sanskrit","units":[
      {"name":"शेमुषी — गद्य","subtopics":["गद्य-बोध","चरित्र और विषय","शब्दार्थ"]},
      {"name":"शेमुषी — पद्य","subtopics":["श्लोक","भावार्थ","काव्य-सौंदर्य"]},
      {"name":"संस्कृत व्याकरण","subtopics":["संधि","समास","प्रत्यय और वाच्य"]},
      {"name":"रचनात्मक कार्य","subtopics":["पत्र","चित्र-वर्णन","अनुच्छेद और संवाद"]}
    ]},
    {"grade":"Class 10","subject":"Sanskrit","units":[
      {"name":"शेमुषी — गद्य","subtopics":["गद्य-बोध","आलोचनात्मक विवेचन","शब्दार्थ"]},
      {"name":"शेमुषी — पद्य","subtopics":["श्लोक","भावार्थ","काव्य-सौंदर्य"]},
      {"name":"संस्कृत व्याकरण","subtopics":["संधि","समास","प्रत्यय और वाच्य"]},
      {"name":"रचनात्मक कार्य","subtopics":["पत्र","चित्र-वर्णन","अनुच्छेद और संवाद"]}
    ]},

    {"grade":"Class 11","subject":"Physics","units":[
      {"name":"Units and Measurements","subtopics":["SI units","Dimensional analysis","Errors and significant figures"]},
      {"name":"Motion in a Straight Line","subtopics":["Position and displacement","Velocity and acceleration","Motion graphs"]},
      {"name":"Motion in a Plane","subtopics":["Vectors","Projectile motion","Uniform circular motion"]},
      {"name":"Laws of Motion","subtopics":["Newton's laws","Friction","Circular motion dynamics"]},
      {"name":"Work, Energy and Power","subtopics":["Work-energy theorem","Potential energy","Collisions"]},
      {"name":"System of Particles and Rotational Motion","subtopics":["Centre of mass","Torque and angular momentum","Moment of inertia"]},
      {"name":"Gravitation","subtopics":["Universal law","Satellites","Escape speed"]},
      {"name":"Mechanical Properties of Solids","subtopics":["Stress and strain","Elastic moduli","Hooke's law"]},
      {"name":"Mechanical Properties of Fluids","subtopics":["Pressure","Bernoulli's principle","Viscosity and surface tension"]},
      {"name":"Thermal Properties of Matter","subtopics":["Thermal expansion","Calorimetry","Heat transfer"]},
      {"name":"Thermodynamics","subtopics":["Laws of thermodynamics","Thermodynamic processes","Heat engines"]},
      {"name":"Kinetic Theory","subtopics":["Ideal gas","Degrees of freedom","Mean free path"]},
      {"name":"Oscillations","subtopics":["Simple harmonic motion","Energy in SHM","Pendulum"]},
      {"name":"Waves","subtopics":["Wave motion","Standing waves","Doppler effect"]}
    ]},
    {"grade":"Class 12","subject":"Physics","units":[
      {"name":"Electric Charges and Fields","subtopics":["Coulomb's law","Electric field","Gauss's law"]},
      {"name":"Electrostatic Potential and Capacitance","subtopics":["Potential","Capacitors","Dielectrics"]},
      {"name":"Current Electricity","subtopics":["Drift velocity","Kirchhoff's laws","Wheatstone bridge"]},
      {"name":"Moving Charges and Magnetism","subtopics":["Lorentz force","Biot-Savart law","Ampere's law"]},
      {"name":"Magnetism and Matter","subtopics":["Bar magnet","Magnetic materials","Earth's magnetism"]},
      {"name":"Electromagnetic Induction","subtopics":["Faraday's laws","Lenz's law","Inductance"]},
      {"name":"Alternating Current","subtopics":["AC circuits","LCR resonance","Transformers"]},
      {"name":"Electromagnetic Waves","subtopics":["Displacement current","EM spectrum","Wave properties"]},
      {"name":"Ray Optics and Optical Instruments","subtopics":["Reflection and refraction","Lenses","Optical instruments"]},
      {"name":"Wave Optics","subtopics":["Interference","Diffraction","Polarisation"]},
      {"name":"Dual Nature of Radiation and Matter","subtopics":["Photoelectric effect","de Broglie waves","Matter waves"]},
      {"name":"Atoms","subtopics":["Bohr model","Hydrogen spectrum","Energy levels"]},
      {"name":"Nuclei","subtopics":["Mass defect","Radioactivity","Nuclear energy"]},
      {"name":"Semiconductor Electronics","subtopics":["Semiconductors","Diodes","Logic gates"]}
    ]},
    {"grade":"Class 11","subject":"Chemistry","units":[
      {"name":"Some Basic Concepts of Chemistry","subtopics":["Mole concept","Stoichiometry","Concentration terms"]},
      {"name":"Structure of Atom","subtopics":["Quantum numbers","Orbitals","Electronic configuration"]},
      {"name":"Classification of Elements and Periodicity","subtopics":["Periodic table","Atomic properties","Periodic trends"]},
      {"name":"Chemical Bonding and Molecular Structure","subtopics":["Ionic and covalent bonding","VSEPR","Hybridisation and molecular orbitals"]},
      {"name":"Chemical Thermodynamics","subtopics":["Enthalpy","Hess's law","Entropy and Gibbs energy"]},
      {"name":"Equilibrium","subtopics":["Chemical equilibrium","Ionic equilibrium","pH and buffers"]},
      {"name":"Redox Reactions","subtopics":["Oxidation number","Balancing redox reactions","Applications"]},
      {"name":"Organic Chemistry: Basic Principles and Techniques","subtopics":["Nomenclature","Electronic effects","Reaction intermediates"]},
      {"name":"Hydrocarbons","subtopics":["Alkanes","Alkenes and alkynes","Aromatic hydrocarbons"]}
    ]},
    {"grade":"Class 12","subject":"Chemistry","units":[
      {"name":"Solutions","subtopics":["Concentration","Raoult's law","Colligative properties"]},
      {"name":"Electrochemistry","subtopics":["Electrochemical cells","Nernst equation","Electrolysis"]},
      {"name":"Chemical Kinetics","subtopics":["Rate law","Order of reaction","Arrhenius equation"]},
      {"name":"d- and f-Block Elements","subtopics":["Transition elements","Lanthanoids","Actinoids"]},
      {"name":"Coordination Compounds","subtopics":["Nomenclature","Isomerism","Bonding theories"]},
      {"name":"Haloalkanes and Haloarenes","subtopics":["Preparation","Substitution reactions","Environmental effects"]},
      {"name":"Alcohols, Phenols and Ethers","subtopics":["Preparation","Properties","Reactions"]},
      {"name":"Aldehydes, Ketones and Carboxylic Acids","subtopics":["Nucleophilic addition","Oxidation and reduction","Acidity"]},
      {"name":"Amines","subtopics":["Classification","Preparation and reactions","Diazonium salts"]},
      {"name":"Biomolecules","subtopics":["Carbohydrates","Proteins","Nucleic acids"]}
    ]},
    {"grade":"Class 11","subject":"Mathematics","units":[
      {"name":"Sets","subtopics":["Set operations","Venn diagrams","Intervals"]},
      {"name":"Relations and Functions","subtopics":["Relations","Functions","Domain and range"]},
      {"name":"Trigonometric Functions","subtopics":["Angles","Identities","Graphs"]},
      {"name":"Complex Numbers and Quadratic Equations","subtopics":["Algebra of complex numbers","Argand plane","Quadratic equations"]},
      {"name":"Linear Inequalities","subtopics":["One-variable inequalities","Graphical solutions","Applications"]},
      {"name":"Permutations and Combinations","subtopics":["Counting principle","Permutations","Combinations"]},
      {"name":"Binomial Theorem","subtopics":["Expansion","General term","Middle term"]},
      {"name":"Sequences and Series","subtopics":["Arithmetic progression","Geometric progression","Special series"]},
      {"name":"Straight Lines","subtopics":["Slope","Forms of line","Distance from a line"]},
      {"name":"Conic Sections","subtopics":["Circle","Parabola","Ellipse and hyperbola"]},
      {"name":"Introduction to Three-dimensional Geometry","subtopics":["Coordinates","Distance formula","Section formula"]},
      {"name":"Limits and Derivatives","subtopics":["Limits","Derivative from first principles","Basic derivatives"]},
      {"name":"Statistics","subtopics":["Dispersion","Variance","Standard deviation"]},
      {"name":"Probability","subtopics":["Events","Axiomatic probability","Addition rule"]}
    ]},
    {"grade":"Class 12","subject":"Mathematics","units":[
      {"name":"Relations and Functions","subtopics":["Types of relations","Types of functions","Composition"]},
      {"name":"Inverse Trigonometric Functions","subtopics":["Principal values","Properties","Graphs"]},
      {"name":"Matrices","subtopics":["Matrix operations","Transpose","Symmetric matrices"]},
      {"name":"Determinants","subtopics":["Properties","Adjoint and inverse","Linear equations"]},
      {"name":"Continuity and Differentiability","subtopics":["Continuity","Differentiability","Chain rule"]},
      {"name":"Applications of Derivatives","subtopics":["Rate of change","Tangents and normals","Maxima and minima"]},
      {"name":"Integrals","subtopics":["Indefinite integrals","Definite integrals","Properties"]},
      {"name":"Applications of Integrals","subtopics":["Area under curves","Area between curves","Applications"]},
      {"name":"Differential Equations","subtopics":["Order and degree","Formation","Solution methods"]},
      {"name":"Vector Algebra","subtopics":["Vectors","Dot product","Cross product"]},
      {"name":"Three-dimensional Geometry","subtopics":["Direction cosines","Lines in space","Shortest distance"]},
      {"name":"Linear Programming","subtopics":["Constraints","Feasible region","Optimisation"]},
      {"name":"Probability","subtopics":["Conditional probability","Bayes theorem","Random variables"]}
    ]},
    {"grade":"Class 11","subject":"Biology","units":[
      {"name":"The Living World","subtopics":["Biodiversity","Taxonomy","Nomenclature"]},
      {"name":"Biological Classification","subtopics":["Five kingdom classification","Viruses","Lichens"]},
      {"name":"Plant Kingdom","subtopics":["Algae and bryophytes","Pteridophytes","Gymnosperms and angiosperms"]},
      {"name":"Animal Kingdom","subtopics":["Basis of classification","Non-chordates","Chordates"]},
      {"name":"Morphology of Flowering Plants","subtopics":["Root stem and leaf","Inflorescence and flower","Fruit and seed"]},
      {"name":"Anatomy of Flowering Plants","subtopics":["Tissues","Dicot and monocot anatomy","Secondary growth"]},
      {"name":"Structural Organisation in Animals","subtopics":["Animal tissues","Organ systems","Frog morphology"]},
      {"name":"Cell: The Unit of Life","subtopics":["Cell theory","Cell organelles","Prokaryotic and eukaryotic cells"]},
      {"name":"Biomolecules","subtopics":["Proteins","Carbohydrates and lipids","Enzymes"]},
      {"name":"Cell Cycle and Cell Division","subtopics":["Cell cycle","Mitosis","Meiosis"]},
      {"name":"Photosynthesis in Higher Plants","subtopics":["Light reaction","Calvin cycle","C3 and C4 pathways"]},
      {"name":"Respiration in Plants","subtopics":["Glycolysis","Krebs cycle","Electron transport"]},
      {"name":"Plant Growth and Development","subtopics":["Growth","Plant hormones","Photoperiodism"]},
      {"name":"Breathing and Exchange of Gases","subtopics":["Respiratory system","Gas exchange","Respiratory disorders"]},
      {"name":"Body Fluids and Circulation","subtopics":["Blood","Heart and circulation","Lymph"]},
      {"name":"Excretory Products and their Elimination","subtopics":["Kidney","Urine formation","Osmoregulation"]},
      {"name":"Locomotion and Movement","subtopics":["Muscles","Skeleton","Movement disorders"]},
      {"name":"Neural Control and Coordination","subtopics":["Neuron","Nervous system","Sense organs"]},
      {"name":"Chemical Coordination and Integration","subtopics":["Endocrine glands","Hormones","Hormonal disorders"]}
    ]},
    {"grade":"Class 12","subject":"Biology","units":[
      {"name":"Sexual Reproduction in Flowering Plants","subtopics":["Flower structure","Pollination and fertilisation","Seed development"]},
      {"name":"Human Reproduction","subtopics":["Reproductive systems","Gametogenesis","Pregnancy and birth"]},
      {"name":"Reproductive Health","subtopics":["Contraception","Infertility","Sexually transmitted infections"]},
      {"name":"Principles of Inheritance and Variation","subtopics":["Mendelian genetics","Chromosomal theory","Genetic disorders"]},
      {"name":"Molecular Basis of Inheritance","subtopics":["DNA and RNA","Replication and transcription","Genetic code"]},
      {"name":"Evolution","subtopics":["Origin of life","Natural selection","Human evolution"]},
      {"name":"Human Health and Disease","subtopics":["Immunity","Diseases","Cancer and AIDS"]},
      {"name":"Microbes in Human Welfare","subtopics":["Household products","Industrial products","Sewage and biogas"]},
      {"name":"Biotechnology: Principles and Processes","subtopics":["Genetic engineering","Vectors","Bioreactors"]},
      {"name":"Biotechnology and its Applications","subtopics":["Medicine","Agriculture","Ethical issues"]},
      {"name":"Organisms and Populations","subtopics":["Adaptations","Population attributes","Interactions"]},
      {"name":"Ecosystem","subtopics":["Energy flow","Ecological pyramids","Nutrient cycles"]},
      {"name":"Biodiversity and Conservation","subtopics":["Biodiversity patterns","Extinction","Conservation strategies"]}
    ]}
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
      'NCERT / CBSE 2026-27 concept catalog for teacher planning and assignments.',
      'NCERT',
      CASE
        WHEN v_course->>'grade' IN ('Class 11', 'Class 12')
          THEN 'https://cbseacademic.nic.in/curriculum_2027.html'
        ELSE 'https://ncert.nic.in/textbook.php'
      END,
      '2026-27'
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      grade = EXCLUDED.grade,
      description = EXCLUDED.description,
      board = EXCLUDED.board,
      source_url = EXCLUDED.source_url,
      source_version = EXCLUDED.source_version;

    INSERT INTO public.syllabi (id, course_id, version, is_active)
    VALUES (v_syllabus_id, v_course_id, 202627, TRUE)
    ON CONFLICT (id) DO UPDATE SET is_active = TRUE;

    v_unit_order := 0;
    FOR v_unit IN SELECT value FROM jsonb_array_elements(v_course->'units')
    LOOP
      v_unit_order := v_unit_order + 1;
      v_chapter_id := md5(
        v_syllabus_id::text || '|chapter|' || lower(v_unit->>'name')
      )::uuid;
      v_topic_id := md5(
        v_chapter_id::text || '|topic|' || lower(v_unit->>'name')
      )::uuid;

      INSERT INTO public.chapters (id, syllabus_id, name, sequence_order)
      VALUES (v_chapter_id, v_syllabus_id, v_unit->>'name', v_unit_order)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        sequence_order = EXCLUDED.sequence_order;

      INSERT INTO public.topics (id, chapter_id, name, sequence_order)
      VALUES (v_topic_id, v_chapter_id, v_unit->>'name', 1)
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

      v_subtopic_order := 0;
      FOR v_subtopic IN
        SELECT value #>> '{}' FROM jsonb_array_elements(v_unit->'subtopics')
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
END
$seed$;
