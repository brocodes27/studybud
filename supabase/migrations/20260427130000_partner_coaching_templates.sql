-- ============================================
-- Partner Coaching Template Seed Data
-- Sample JEE 2-Year & 1-Year coaching templates
-- Idempotent: uses ON CONFLICT DO NOTHING for inserts
-- ============================================

-- Some remote environments may already have coaching_templates created with a partial schema.
-- Ensure required columns exist before seeding.
ALTER TABLE public.coaching_templates
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS institute_name TEXT,
  ADD COLUMN IF NOT EXISTS year_level TEXT,
  ADD COLUMN IF NOT EXISTS program TEXT DEFAULT 'JEE',
  ADD COLUMN IF NOT EXISTS test_calendar JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS syllabus_map JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Some prod schemas enforce institute_name as NOT NULL. Seed both name + institute_name.
-- Some prod schemas also enforce year_level as NOT NULL.
INSERT INTO public.coaching_templates (id, institute_name, year_level, name, program, test_calendar, syllabus_map, created_at)
VALUES
  (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
    'Allen Kota — JEE 2-Year (11th + 12th)',
    '11,12',
    'Allen Kota — JEE 2-Year (11th + 12th)',
    'JEE',
    '[
      {"week": 1, "test": "Unit Test — Mechanics Basics", "date_offset_days": 7},
      {"week": 4, "test": "Monthly — Mechanics Full", "date_offset_days": 28},
      {"week": 8, "test": "Quarterly — Physics + Chem", "date_offset_days": 56},
      {"week": 12, "test": "Phase Test — Mechanics + Organic", "date_offset_days": 84}
    ]'::jsonb,
    '{
      "11th_physics": ["Units & Dimensions", "Kinematics", "Laws of Motion", "Work Energy Power", "Rotational Motion", "Gravitation", "Properties of Matter", "Thermodynamics", "Kinetic Theory", "Oscillations", "Waves"],
      "11th_chemistry": ["Some Basic Concepts", "Structure of Atom", "Classification of Elements", "Chemical Bonding", "States of Matter", "Thermodynamics", "Equilibrium", "Redox Reactions", "Hydrogen", "s-Block", "p-Block"],
      "11th_mathematics": ["Sets", "Relations & Functions", "Trigonometric Functions", "Complex Numbers", "Linear Inequalities", "Permutations & Combinations", "Binomial Theorem", "Sequences & Series", "Straight Lines", "Conic Sections", "3D Geometry", "Limits & Derivatives"],
      "12th_physics": ["Electric Charges & Fields", "Electrostatic Potential", "Current Electricity", "Moving Charges & Magnetism", "Magnetism & Matter", "Electromagnetic Induction", "Alternating Current", "Electromagnetic Waves", "Ray Optics", "Wave Optics", "Dual Nature", "Atoms", "Nuclei", "Semiconductors"],
      "12th_chemistry": ["Solutions", "Electrochemistry", "Chemical Kinetics", "Surface Chemistry", "p-Block (Advanced)", "d-Block & f-Block", "Coordination Compounds", "Haloalkanes & Haloarenes", "Alcohols Phenols Ethers", "Aldehydes Ketones Carboxylic Acids", "Amines", "Biomolecules", "Polymers"],
      "12th_mathematics": ["Relations & Functions (Adv)", "Inverse Trigonometry", "Matrices", "Determinants", "Continuity & Differentiability", "Application of Derivatives", "Integrals", "Application of Integrals", "Differential Equations", "Vector Algebra", "3D Geometry (Adv)", "Linear Programming", "Probability"]
    }'::jsonb,
    NOW()
  ),
  (
    'b2c3d4e5-f6a7-8901-bcde-f12345678901'::uuid,
    'Resonance — JEE 1-Year Droppers',
    'Dropper',
    'Resonance — JEE 1-Year Droppers',
    'JEE',
    '[
      {"week": 1, "test": "Revision Test — 11th Physics", "date_offset_days": 7},
      {"week": 2, "test": "Revision Test — 11th Chemistry", "date_offset_days": 14},
      {"week": 4, "test": "Part Test — Physics + Chem", "date_offset_days": 28},
      {"week": 6, "test": "Full Syllabus Mock 1", "date_offset_days": 42},
      {"week": 10, "test": "Full Syllabus Mock 2", "date_offset_days": 70}
    ]'::jsonb,
    '{
      "physics": ["Complete 11th Revision", "Electrostatics", "Current Electricity", "Magnetism", "EMI & AC", "Optics", "Modern Physics", "Error Analysis"],
      "chemistry": ["Complete 11th Revision", "Solutions & Electrochemistry", "Chemical Kinetics", "Organic — Alcohols & Ethers", "Organic — Carbonyl & Amines", "Organic — Biomolecules & Polymers", "Inorganic — d&f Block & Coordination", "Inorganic — p-Block Advanced"],
      "mathematics": ["Complete 11th Revision", "Matrices & Determinants", "Calculus — Differentiation & Applications", "Calculus — Integration & Applications", "Differential Equations", "Vector & 3D", "Probability & Statistics"]
    }'::jsonb,
    NOW()
  )
ON CONFLICT (id) DO NOTHING;
