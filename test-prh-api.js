// PRH/YTJ API Test Script
// Aja lokaalisti: node test-prh-api.js

async function testPRHApi(companyName) {
  console.log(`\n🔍 Haetaan: "${companyName}"\n`);
  
  try {
    // 1. Hae yritys nimellä
    const searchUrl = `https://avoindata.prh.fi/bis/v1?name=${encodeURIComponent(companyName)}&maxResults=5&resultsFrom=0`;
    console.log(`📡 URL: ${searchUrl}\n`);
    
    const response = await fetch(searchUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'JobScout-Test/1.0'
      }
    });
    
    if (!response.ok) {
      console.log(`❌ HTTP Error: ${response.status}`);
      return;
    }
    
    const data = await response.json();
    
    if (!data.results || data.results.length === 0) {
      console.log(`❌ Yritystä "${companyName}" ei löytynyt`);
      return;
    }
    
    console.log(`✅ Löytyi ${data.results.length} tulosta\n`);
    
    // Näytä ensimmäinen tulos
    const company = data.results[0];
    console.log("📋 PERUSTIEDOT:");
    console.log(`   Nimi: ${company.name}`);
    console.log(`   Y-tunnus: ${company.businessId}`);
    console.log(`   Rekisteröity: ${company.registrationDate}`);
    console.log(`   Yritysmuoto: ${company.companyForm}`);
    
    // 2. Hae lisätiedot
    if (company.detailsUri) {
      console.log(`\n📡 Haetaan lisätiedot: ${company.detailsUri}\n`);
      
      const detailsResponse = await fetch(company.detailsUri, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'JobScout-Test/1.0'
        }
      });
      
      if (detailsResponse.ok) {
        const details = await detailsResponse.json();
        
        console.log("📋 LISÄTIEDOT:");
        
        // Osoite
        if (details.addresses && details.addresses.length > 0) {
          const addr = details.addresses[0];
          console.log(`   Osoite: ${addr.street || ''}, ${addr.postCode || ''} ${addr.city || ''}`);
        }
        
        // Toimialat
        if (details.businessLines && details.businessLines.length > 0) {
          console.log(`   Toimialat:`);
          details.businessLines.slice(0, 3).forEach(bl => {
            console.log(`     - ${bl.name}`);
          });
        }
        
        // Yhtiömuoto
        if (details.companyForms && details.companyForms.length > 0) {
          console.log(`   Yhtiömuoto: ${details.companyForms[0].name}`);
        }
        
        // Rekisteröinnit
        if (details.registeredEntries && details.registeredEntries.length > 0) {
          console.log(`   Rekisteröinnit:`);
          details.registeredEntries.slice(0, 5).forEach(entry => {
            console.log(`     - ${entry.register}: ${entry.description} (${entry.registrationDate})`);
          });
        }
      }
    }
    
    // Muut hakutulokset
    if (data.results.length > 1) {
      console.log("\n📋 MUUT HAKUTULOKSET:");
      data.results.slice(1).forEach((r, i) => {
        console.log(`   ${i+2}. ${r.name} (${r.businessId})`);
      });
    }
    
  } catch (error) {
    console.log(`❌ Virhe: ${error.message}`);
  }
}

// Testaa eri yrityksiä
async function runTests() {
  console.log("========================================");
  console.log("🏢 PRH/YTJ API Testi");
  console.log("========================================");
  
  await testPRHApi("Reaktor");
  await testPRHApi("Supercell");
  await testPRHApi("Wolt");
  await testPRHApi("Futurice");
}

runTests();
