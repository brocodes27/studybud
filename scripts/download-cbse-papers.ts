import { config } from 'dotenv';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

config();

// CBSE Sample Paper URLs
const CBSE_RESOURCES = {
    'class10-2025-26': 'https://cbseacademic.nic.in/sqp_classx_2025-26.html',
    'class10-2024-25': 'https://cbseacademic.nic.in/sqp_classx_2024-25.html',
    'class12-2024-25': 'https://cbseacademic.nic.in/SQP_CLASSXii_2024-25.html',
};

const OUTPUT_DIR = 'pyq-pdfs';
const DRY_RUN = process.argv.includes('--dry-run');

// Subjects to download (customize as needed)
const CLASS_10_SUBJECTS = [
    'English',
    'Hindi',
    'Mathematics',
    'Science',
    'Social Science'
];

const CLASS_12_SUBJECTS = [
    'English',
    'Physics',
    'Chemistry',
    'Mathematics',
    'Biology',
    'Computer Science',
    'Accountancy',
    'Business Studies',
    'Economics',
    'History',
    'Political Science',
    'Geography',
    'Psychology',
    'Sociology'
];

interface PDFLink {
    url: string;
    filename: string;
    subject: string;
    classLevel: string;
    year: string;
}

async function fetchHTML(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    }
    return await response.text();
}

function extractPDFLinks(html: string, classLevel: string, year: string): PDFLink[] {
    const links: PDFLink[] = [];

    // Match PDF links in the HTML
    // CBSE typically uses patterns like: /web_material/SQP/ClassX/...pdf
    const pdfRegex = /href="([^"]*\.pdf)"/gi;
    let match;

    while ((match = pdfRegex.exec(html)) !== null) {
        const relativeUrl = match[1];

        // Convert relative URL to absolute
        let absoluteUrl = relativeUrl;
        if (!relativeUrl.startsWith('http')) {
            absoluteUrl = relativeUrl.startsWith('/')
                ? `https://cbseacademic.nic.in${relativeUrl}`
                : `https://cbseacademic.nic.in/${relativeUrl}`;
        }

        // Extract filename and try to determine subject
        const filename = relativeUrl.split('/').pop() || 'unknown.pdf';

        // Try to match subject from filename
        const subjects = classLevel === '10' ? CLASS_10_SUBJECTS : CLASS_12_SUBJECTS;
        const foundSubject = subjects.find(s =>
            filename.toLowerCase().includes(s.toLowerCase().replace(/\s+/g, ''))
        );

        links.push({
            url: absoluteUrl,
            filename: filename,
            subject: foundSubject || 'Unknown',
            classLevel: classLevel,
            year: year
        });
    }

    return links;
}

async function downloadPDF(link: PDFLink, outputPath: string): Promise<boolean> {
    try {
        console.log(`  Downloading: ${link.filename}...`);

        const response = await fetch(link.url);
        if (!response.ok) {
            console.error(`    ❌ Failed: ${response.statusText}`);
            return false;
        }

        if (!response.body) {
            console.error(`    ❌ No response body`);
            return false;
        }

        const fileStream = createWriteStream(outputPath);
        await pipeline(response.body as any, fileStream);

        console.log(`    ✅ Saved to: ${outputPath}`);
        return true;
    } catch (error: any) {
        console.error(`    ❌ Error: ${error.message}`);
        return false;
    }
}

async function main() {
    console.log('🎓 CBSE Sample Paper Downloader\n');
    console.log(`Dry run: ${DRY_RUN ? 'YES' : 'NO'}\n`);

    // Create output directory
    if (!existsSync(OUTPUT_DIR)) {
        mkdirSync(OUTPUT_DIR, { recursive: true });
        console.log(`📁 Created directory: ${OUTPUT_DIR}\n`);
    }

    const allLinks: PDFLink[] = [];
    const downloadStats = {
        total: 0,
        success: 0,
        failed: 0,
        skipped: 0
    };

    // Fetch and extract links from each resource page
    for (const [key, url] of Object.entries(CBSE_RESOURCES)) {
        console.log(`🔍 Fetching: ${url}`);

        try {
            const html = await fetchHTML(url);

            // Extract class and year from key
            const classLevel = key.includes('class10') ? '10' : '12';
            const year = key.match(/\d{4}-\d{2}/)?.[0] || 'unknown';

            const links = extractPDFLinks(html, classLevel, year);
            console.log(`  ✅ Found ${links.length} PDF links\n`);

            allLinks.push(...links);
        } catch (error: any) {
            console.error(`  ❌ Error: ${error.message}\n`);
        }
    }

    console.log(`📊 Total PDFs found: ${allLinks.length}\n`);

    if (DRY_RUN) {
        console.log('🔍 DRY RUN - Would download:');
        allLinks.forEach((link, i) => {
            console.log(`  ${i + 1}. [Class ${link.classLevel}] ${link.subject} - ${link.filename}`);
        });
        return;
    }

    // Download each PDF
    console.log('⬇️  Starting downloads...\n');

    for (const [index, link] of allLinks.entries()) {
        downloadStats.total++;

        // Create subdirectory for class
        const classDir = join(OUTPUT_DIR, `class-${link.classLevel}`);
        if (!existsSync(classDir)) {
            mkdirSync(classDir, { recursive: true });
        }

        // Determine output path
        const outputPath = join(classDir, link.filename);

        // Skip if already exists
        if (existsSync(outputPath)) {
            console.log(`  [${index + 1}/${allLinks.length}] ⏭️  Skipped (exists): ${link.filename}`);
            downloadStats.skipped++;
            continue;
        }

        console.log(`  [${index + 1}/${allLinks.length}] Class ${link.classLevel} - ${link.subject}`);

        const success = await downloadPDF(link, outputPath);
        if (success) {
            downloadStats.success++;
        } else {
            downloadStats.failed++;
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Download Summary');
    console.log('='.repeat(60));
    console.log(`Total found: ${downloadStats.total}`);
    console.log(`  ✅ Downloaded: ${downloadStats.success}`);
    console.log(`  ⏭️  Skipped (exists): ${downloadStats.skipped}`);
    console.log(`  ❌ Failed: ${downloadStats.failed}`);
    console.log('\n✨ Done!\n');

    // Save a manifest
    const manifest = {
        downloaded_at: new Date().toISOString(),
        stats: downloadStats,
        files: allLinks.map(l => ({
            class: l.classLevel,
            subject: l.subject,
            filename: l.filename,
            year: l.year
        }))
    };

    writeFileSync(
        join(OUTPUT_DIR, 'manifest.json'),
        JSON.stringify(manifest, null, 2)
    );

    console.log(`📄 Manifest saved to: ${join(OUTPUT_DIR, 'manifest.json')}\n`);
}

main().catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
});
