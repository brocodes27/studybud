-- Create cbse_syllabi table for storing fetched syllabi
CREATE TABLE IF NOT EXISTS cbse_syllabi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject TEXT NOT NULL,
    class_level TEXT NOT NULL,
    syllabus_data JSONB NOT NULL,
    total_marks INTEGER NOT NULL,
    units_count INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(subject, class_level)
);

-- Create indexes for performance
CREATE INDEX idx_cbse_syllabi_subject_class ON cbse_syllabi(subject, class_level);
CREATE INDEX idx_cbse_syllabi_created_at ON cbse_syllabi(created_at);

-- Enable RLS
ALTER TABLE cbse_syllabi ENABLE ROW LEVEL SECURITY;

-- Create RLS policies - allow all authenticated users to read syllabi
CREATE POLICY "Everyone can view syllabi" ON cbse_syllabi
    FOR SELECT USING (true);

-- Allow authenticated users to insert/update syllabi
CREATE POLICY "Authenticated users can insert syllabi" ON cbse_syllabi
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update syllabi" ON cbse_syllabi
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_cbse_syllabi_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER update_cbse_syllabi_updated_at
    BEFORE UPDATE ON cbse_syllabi
    FOR EACH ROW
    EXECUTE FUNCTION update_cbse_syllabi_updated_at();
