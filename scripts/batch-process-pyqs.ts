import { config } from 'dotenv';
import { readdirSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { execSync } from 'child_process';

// Load environment variables
config();

const PDF_BASE_DIR = 'pyq-pdfs';
const EXTRACTED_DIR = 'pyq-extracted';

// Parse args
const LIMIT = parseInt(process.argv.find(arg => arg.startsWith('--limit='))?.split('=')[1] || '0');
const CLASS_FILTER = process.argv.find(arg => arg.startsWith('--class='))?.split('=')[1];
const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
    console.log('🚀 Batch PYQ Processing Started\n');

    const classes = ['class-10', 'class-12'];
    let processedCount = 0;

    for (const classDir of classes) {
        const classLevel = classDir.replace('class-', '');

        if (CLASS_FILTER && CLASS_FILTER !== classLevel) continue;

        const dirPath = join(PDF_BASE_DIR, classDir);
        if (!existsSync(dirPath)) {
            console.warn(`⚠️ Directory not found: ${dirPath}`);
            continue;
        }

        const files = readdirSync(dirPath).filter(f => f.endsWith('-SQP.pdf'));

        // Filter by allowed subjects (Frontend Options)
        const ALLOWED_PATTERNS: Record<string, RegExp[]> = {
            'class-10': [
                /Maths(Standard|Basic)-SQP\.pdf$/,
                /Science-SQP\.pdf$/,
                /SocialScience-SQP\.pdf$/,
                /EnglishL-SQP\.pdf$/,
                /HindiCourse[AB]-SQP\.pdf$/,
                /Sanskrit-SQP\.pdf$/,
                /ComputerApplication-SQP\.pdf$/,
                /HomeScience-SQP\.pdf$/
            ],
            'class-12': [
                /Physics-SQP\.pdf$/,
                /Chemistry-SQP\.pdf$/,
                /(Applied-)?Maths-SQP\.pdf$/,
                /Biology-SQP\.pdf$/,
                /EnglishCore-SQP\.pdf$/,
                /ComputerScience-SQP\.pdf$/,
                /PhysicalEducation-SQP\.pdf$/,
                /InformaticsPractices-SQP\.pdf$/,
                /Accountancy-SQP\.pdf$/,
                /BusinessStudies-SQP\.pdf$/,
                /Economics-SQP\.pdf$/,
                /History-SQP\.pdf$/,
                /Geography-SQP\.pdf$/,
                /PolSci-SQP\.pdf$/,
                /Psychology-SQP\.pdf$/,
                /Sociology-SQP\.pdf$/
            ]
        };

        const allowedFiles = files.filter(f =>
            ALLOWED_PATTERNS[classDir]?.some(regex => regex.test(f))
        );

        console.log(`📂 Found ${files.length} SQP files in ${classDir} (${allowedFiles.length} matched frontend options)`);

        for (const file of allowedFiles) {
            if (LIMIT > 0 && processedCount >= LIMIT) {
                console.log(`\n🛑 Limit of ${LIMIT} reached. Stopping.`);
                return;
            }

            const subject = file.replace('-SQP.pdf', '').replace(/_/g, ' ');
            const pdfPath = join(dirPath, file);
            const year = '2024-25'; // Assuming current batch is 2024-25

            // Check if already extracted
            const expectedJsonName = `class${classLevel}-${subject.replace(/\s+/g, '_')}-${year}.json`;
            const expectedJsonPath = join(EXTRACTED_DIR, expectedJsonName);

            if (existsSync(expectedJsonPath)) {
                console.log(`⏭️ Skipping ${file} (Already extracted)`);
                continue;
            }

            console.log(`\n🔄 Processing ${processedCount + 1}: ${file} (${subject})...`);

            const command = `npx tsx scripts/extract-pyq-from-pdf.ts "${pdfPath}" --class=${classLevel} --subject="${subject}" --year="${year}" --auto-import`;

            if (DRY_RUN) {
                console.log(`  [DRY RUN] Would execute: ${command}`);
            } else {
                try {
                    execSync(command, { stdio: 'inherit' });
                    console.log(`  ✅ Success: ${file}`);
                } catch (error) {
                    console.error(`  ❌ Failed: ${file}`);
                    // Continue to next file instead of crashing
                }
            }

            processedCount++;

            // Small delay to be nice to APIs
            if (!DRY_RUN) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    }

    console.log(`\n✨ Batch processing complete! Processed ${processedCount} files.`);
}

main();
