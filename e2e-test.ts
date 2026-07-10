import { PrismaClient } from '@prisma/client';
import axios from 'axios';

async function runE2E() {
  const prisma = new PrismaClient();
  const apiBase = 'http://localhost:3001/api';

  try {
    console.log('1. Logging in as admin...');
    const loginRes = await axios.post(`${apiBase}/auth/login`, {
      email: 'admin@pytagotech.com',
      password: '13579Admin'
    });
    const token = loginRes.data.token;
    console.log('✅ Logged in successfully. Token received.');

    // Configure headers
    const headers = { Authorization: `Bearer ${token}` };

    console.log('2. Creating a GMAPS job...');
    const jobRes = await axios.post(`${apiBase}/jobs`, {
      type: 'GMAPS',
      input: {
        keyword: 'Coffee shop',
        location: 'Jakarta',
        maxResults: 2,
        scrollLimit: 2,
        headless: true
      }
    }, { headers });
    
    const jobId = jobRes.data.id;
    console.log(`✅ Job created successfully! ID: ${jobId}`);

    console.log('3. Polling job status (waiting for worker to scrape and analyze)...');
    let jobStatus = 'QUEUED';
    while (jobStatus !== 'COMPLETED' && jobStatus !== 'FAILED') {
      await new Promise(resolve => setTimeout(resolve, 3000));
      const statusRes = await axios.get(`${apiBase}/jobs/${jobId}`, { headers });
      jobStatus = statusRes.data.status;
      console.log(`   Status: ${jobStatus}`);
    }

    if (jobStatus === 'FAILED') {
      const finalJob = await axios.get(`${apiBase}/jobs/${jobId}`, { headers });
      throw new Error(`Job failed: ${finalJob.data.error}`);
    }

    console.log('✅ Job completed successfully!');

    console.log('4. Verifying leads were saved and analyzed by AI...');
    const leadsRes = await axios.get(`${apiBase}/leads?jobId=${jobId}`, { headers });
    const leads = leadsRes.data.data;
    
    if (leads.length === 0) {
      console.log('⚠️ Job completed but no leads were found.');
    } else {
      console.log(`✅ Found ${leads.length} leads.`);
      const firstLead = leads[0];
      console.log('   Sample Lead:');
      console.log(`   - Business Name: ${firstLead.businessName}`);
      console.log(`   - AI Score: ${firstLead.aiAnalysis?.leadScore}`);
      console.log(`   - AI Summary: ${firstLead.aiAnalysis?.summary?.substring(0, 50)}...`);
      
      if (!firstLead.aiAnalysis) {
        throw new Error('Lead missing AI Analysis! The AI processor may have failed.');
      }
    }
    
    console.log('🎉 End-to-End Test Passed!');

  } catch (err: any) {
    console.error('❌ E2E Test Failed:', err.response?.data || err.message);
  } finally {
    await prisma.$disconnect();
  }
}

runE2E();
