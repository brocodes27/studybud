import { readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const EXTRACTED_DIR = 'pyq-extracted';

async function main() {
    console.log('📦 Bulk Import Started\n');

    if (!existsSync(EXTRACTED_DIR)) {
        console.error(`❌ Directory not found: ${EXTRACTED_DIR}`);
        process.exit(1);
    }

    const files = readdirSync(EXTRACTED_DIR).filter(f => f.endsWith('.json'));
    console.log(`📂 Found ${files.length} JSON files`);

    let success = 0;
    let failed = 0;

    for (const file of files) {
        console.log(`\n🔄 Importing ${file}...`);
        const filePath = join(EXTRACTED_DIR, file);

        try {
            execSync(`npx tsx scripts/import-pyq-json.ts "${filePath}"`, { stdio: 'inherit' });
            console.log(`  ✅ Success: ${file}`);
            success++;
        } catch (error) {
            console.error(`  ❌ Failed: ${file}`);
            failed++;
        }
    }

    console.log(`\n✨ Bulk import complete!`);
    console.log(`  ✅ Success: ${success}`);
    console.log(`  ❌ Failed: ${failed}`);
}

main();
