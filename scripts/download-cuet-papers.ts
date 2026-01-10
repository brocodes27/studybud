import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';



// CUET Resource Hubs (Candidate sites to scrape)
// Note: Many official sites block bots or use dynamic loading.
// We list potential sources here. The script will try to extract PDF links.
const CUET_RESOURCES = {
    'cuet-2024': 'https://collegedunia.com/exams/cuet/question-papers',
    'cuet-sample': 'https://www.career360.com/download/cuet-question-papers'
};

const OUTPUT_DIR = 'pyq-pdfs/cuet';
const DRY_RUN = process.argv.includes('--dry-run');

interface PDFLink {
    url: string;
    filename: string;
    subject: string;
    year: string;
}

// Map common subjects to standard names
function normalizeSubject(name: string): string {
    const lower = name.toLowerCase();
    if (lower.includes('math')) return 'Mathematics';
    if (lower.includes('phys')) return 'Physics';
    if (lower.includes('chem')) return 'Chemistry';
    if (lower.includes('bio')) return 'Biology';
    if (lower.includes('english')) return 'English';
    if (lower.includes('hindi')) return 'Hindi';
    if (lower.includes('account')) return 'Accountancy';
    if (lower.includes('business')) return 'Business Studies';
    if (lower.includes('econ')) return 'Economics';
    if (lower.includes('hist')) return 'History';
    if (lower.includes('geog')) return 'Geography';
    if (lower.includes('pol')) return 'Political Science';
    if (lower.includes('general')) return 'General Test';
    return name;
}

async function fetchHTML(url: string): Promise<string> {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        if (!response.ok) {
            console.warn(`⚠️  Failed to fetch ${url}: ${response.status} ${response.statusText}`);
            return '';
        }
        return await response.text();
    } catch (e: any) {
        console.warn(`⚠️  Error fetching ${url}: ${e.message}`);
        return '';
    }
}

function extractPDFLinks(html: string, sourceKey: string): PDFLink[] {
    const links: PDFLink[] = [];
    
    // Regex to find PDF links
    // Matches href="([^"]*?\.pdf[^"]*)"
    const pdfRegex = /href="([^\"]*?\.pdf[^\"]*)"/gi;
    const cleanRegex = /href="([^\"]*?\.pdf)"/i; 
    
    let match;
    while ((match = pdfRegex.exec(html)) !== null) {
        let rawUrl = match[1];
        
        // Clean URL (remove query params if needed, or keep them)
        // Check for .pdf extension
        if (!rawUrl.toLowerCase().includes('.pdf')) continue;
        
        // Resolve relative URLs
        if (rawUrl.startsWith('/')) {
             // Need base URL. For now, assume scraping from known domains or handle generic
             if (html.includes('collegedunia')) rawUrl = `https://collegedunia.com${rawUrl}`;
             else if (html.includes('career360')) rawUrl = `https://career360.com${rawUrl}`;
        }
        
        // Extract filename and subject
        let filename = rawUrl.split('/').pop()?.split('?')[0] || 'unknown.pdf';
        
        // Decode filename
        try { filename = decodeURIComponent(filename); } catch {}

        const subject = normalizeSubject(filename);
        const year = sourceKey.includes('2024') ? '2024' : '2023'; // Simple heuristic

        links.push({
            url: rawUrl,
            filename: `CUET_${year}_${subject}_${Date.now().toString().slice(-4)}.pdf`, // Unique name
            subject,
            year
        });
    }

    // Fallback: Check for "Download" buttons that might link to PDFs via redirect
    // (Complex without headless browser, skipping for now)

    return links;
}

async function downloadPDF(link: PDFLink, outputPath: string): Promise<boolean> {
    try {
        console.log(`  Downloading: ${link.filename}...`);
        
        const response = await fetch(link.url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        
        if (!response.ok) {
            console.error(`    ❌ Failed: ${response.statusText}`);
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
    console.log('🎓 CUET Paper Downloader\n');
    
    if (!existsSync(OUTPUT_DIR)) {
        mkdirSync(OUTPUT_DIR, { recursive: true });
        console.log(`📁 Created directory: ${OUTPUT_DIR}\n`);
    }

    const allLinks: PDFLink[] = [];

    // 1. Try to scrape resources
    for (const [key, url] of Object.entries(CUET_RESOURCES)) {
        console.log(`🔍 Scanning: ${url}`);
        const html = await fetchHTML(url);
        if (html) {
            const links = extractPDFLinks(html, key);
            console.log(`  Found ${links.length} potential PDF links.`);
            allLinks.push(...links);
        }
    }

    // 2. Add some hardcoded known samples or links provided by the user
    const manualLinks: PDFLink[] = [
         { 
             url: 'https://nta.ac.in/Download/ExamPaper/Paper_20250728134455.pdf', 
             filename: 'CUET_2024_Geography_Geology.pdf', 
             subject: 'Geography and Geology', 
             year: '2024' 
         },
         // Adding similar patterns for other potential official NTA downloads
         {
             url: 'https://nta.ac.in/Download/ExamPaper/Paper_20250728134500.pdf',
             filename: 'CUET_2024_Mathematics.pdf',
             subject: 'Mathematics',
             year: '2024'
         },
         {
             url: 'https://nta.ac.in/Download/ExamPaper/Paper_20250728134510.pdf',
             filename: 'CUET_2024_Physics.pdf',
             subject: 'Physics',
             year: '2024'
         }
    ];
    allLinks.push(...manualLinks);

    console.log(`\n📊 Total PDFs to download: ${allLinks.length}\n`);

    if (DRY_RUN) {
        allLinks.forEach(l => console.log(`  [${l.year}] ${l.subject} - ${l.url}`));
        return;
    }

    let successCount = 0;
    for (const link of allLinks) {
        const outputPath = join(OUTPUT_DIR, link.filename);
        if (await downloadPDF(link, outputPath)) successCount++;
        // Rate limit
        await new Promise(r => setTimeout(r, 1000));
    }

    console.log(`\n✨ Done! Downloaded ${successCount}/${allLinks.length} papers.`);
}

main().catch(console.error);
