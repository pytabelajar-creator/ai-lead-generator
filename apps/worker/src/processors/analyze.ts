import type { Job } from 'bullmq';
import { prisma } from '@leadgen/db';
import { decrypt } from '@leadgen/shared';
import type { AnalyzeJobData } from '@leadgen/queue';
import { analyzeLeadBatch, type AIClientConfig } from '@leadgen/ai';

// Generate fingerprint for deduplication
function generateLeadFingerprint(data: any): string {
  const parts: string[] = [];

  // Primary: Google Maps URL (most unique)
  if (data.googleMapsUrl) {
    parts.push(data.googleMapsUrl);
  }

  // Secondary: Phone number (normalized)
  if (data.phone) {
    const normalizedPhone = data.phone.replace(/\D/g, '');
    if (normalizedPhone.length >= 7) {
      parts.push(`phone:${normalizedPhone.slice(-10)}`);
    }
  }

  // Tertiary: Business name + address
  if (data.businessName) {
    parts.push(`name:${data.businessName.toLowerCase().trim()}`);
  }
  if (data.address) {
    const normalizedAddress = data.address.toLowerCase().replace(/\s+/g, ' ').trim();
    parts.push(`addr:${normalizedAddress.slice(0, 50)}`);
  }

  return parts.join('|');
}

export async function processAnalyzeJob(job: Job<AnalyzeJobData>) {
  const { jobId, scrapedData, userId } = job.data;

  await job.log(`Starting analysis for ${scrapedData.length} leads on job ${jobId}`);

  try {
    const aiConfigRecord = await prisma.aIConfig.findUnique({
      where: { userId },
    });

    if (!aiConfigRecord) {
      throw new Error('AI Configuration not found for user');
    }

    const aiConfig: AIClientConfig = {
      endpoint: aiConfigRecord.endpoint,
      apiKey: decrypt(aiConfigRecord.apiKey),
      model: aiConfigRecord.model,
      temperature: aiConfigRecord.temperature,
      maxTokens: aiConfigRecord.maxTokens,
      systemPrompt: aiConfigRecord.systemPrompt || undefined,
    };

    // Get existing fingerprints for this user to detect duplicates
    const existingLeads = await prisma.lead.findMany({
      where: {
        job: { userId },
        OR: [
          { googleMapsUrl: { not: null } },
          { phone: { not: null } },
        ],
      },
      select: {
        googleMapsUrl: true,
        phone: true,
        businessName: true,
        address: true,
      },
    });

    // Build set of existing fingerprints
    const existingFingerprints = new Set<string>();
    for (const lead of existingLeads) {
      const fp = generateLeadFingerprint({
        googleMapsUrl: lead.googleMapsUrl,
        phone: lead.phone,
        businessName: lead.businessName,
        address: lead.address,
      });
      existingFingerprints.add(fp);
    }

    // Filter out duplicates
    const uniqueData: typeof scrapedData = [];
    const duplicateIndices: number[] = [];

    scrapedData.forEach((data, index) => {
      const fp = generateLeadFingerprint(data);
      if (existingFingerprints.has(fp)) {
        duplicateIndices.push(index);
      } else {
        uniqueData.push(data);
        existingFingerprints.add(fp); // Add to set to catch within-batch duplicates
      }
    });

    if (duplicateIndices.length > 0) {
      await job.log(`Skipped ${duplicateIndices.length} duplicate leads`);
      console.log(`Deduplication: ${duplicateIndices.length} duplicates found, ${uniqueData.length} unique`);
    }

    if (uniqueData.length === 0) {
      await job.log('All leads were duplicates. Nothing to analyze.');
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });
      return { success: true, leadsAnalyzed: 0, duplicatesSkipped: duplicateIndices.length };
    }

    // Analyze unique leads
    const results = await analyzeLeadBatch(aiConfig, uniqueData);

    // Log any AI errors
    const errors = results.filter(r => !r.success);
    if (errors.length > 0) {
      await job.log(`Warning: ${errors.length} leads failed AI analysis. First error: ${errors[0].error}`);
      console.error(`AI Analysis errors:`, errors.map(e => e.error));
    }

    // Save to DB
    await job.log('Analysis complete. Saving to database...');

    const leadsToCreate = uniqueData.map((raw_data, index) => {
      const result = results[index];
      const data = raw_data as any;

      return {
        jobId,
        rawData: data,
        aiAnalysis: result.success ? (result.analysis as any) : null,

        businessName: (data.businessName || data.username || null) as string | null,
        category: (data.category || data.businessCategory || null) as string | null,
        rating: (data.rating || null) as number | null,
        reviewCount: (data.reviewCount || null) as number | null,
        phone: (data.phone || null) as string | null,
        website: (data.website || null) as string | null,
        address: (data.address || null) as string | null,
        coordinates: data.coordinates as any,
        googleMapsUrl: (data.googleMapsUrl || null) as string | null,
        imageUrls: data.imageUrls as any,
        openingHours: data.openingHours as any,

        email: (data.email || null) as string | null,
        linkedin: (data.linkedin || null) as string | null,
        instagram: (data.instagram || null) as string | null,
        facebook: (data.facebook || null) as string | null,

        leadScore: result.success ? (result.analysis?.leadScore as number | null) : null,
        priority: result.success ? (result.analysis?.priority as any) : null,
        summary: result.success ? (result.analysis?.summary as string | null) : null,
        recommendedServices: result.success ? (result.analysis?.recommendedServices as string | null) : null,
        painPoints: result.success ? (result.analysis?.painPoints as string | null) : null,
        coldEmail: result.success ? (result.analysis?.coldEmail as string | null) : null,
        whatsappMessage: result.success ? (result.analysis?.whatsappMessage as string | null) : null,
      };
    });

    await prisma.$transaction(async (tx) => {
      await tx.lead.createMany({
        data: leadsToCreate,
      });

      await tx.job.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });
    });

    await job.log(`Successfully completed job ${jobId}: ${leadsToCreate.length} leads created, ${duplicateIndices.length} duplicates skipped`);
    return {
      success: true,
      leadsAnalyzed: leadsToCreate.length,
      duplicatesSkipped: duplicateIndices.length,
    };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    await job.log(`Analysis failed: ${errorMsg}`);

    await prisma.job.update({
      where: { id: jobId },
      data: { status: 'FAILED', error: errorMsg },
    });

    throw error;
  }
}
