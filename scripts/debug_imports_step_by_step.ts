
import { performance } from 'perf_hooks';

const log = (msg) => console.log(`[${(performance.now()).toFixed(2)}ms] ${msg}`);

async function testImports() {
  log('Starting imports...');
  
  try {
    log('Importing storage...');
    await import('../server/storage.js');
    log('Storage imported.');

    log('Importing web-search...');
    await import('../server/integrations/web-search.js');
    log('Web-search imported.');

    log('Importing custom-browser...');
    await import('../server/integrations/custom-browser.js');
    log('Custom-browser imported.');

    log('Importing google-tasks...');
    await import('../server/integrations/google-tasks.js');
    log('Google-tasks imported.');

    log('Importing gmail...');
    await import('../server/integrations/gmail.js');
    log('Gmail imported.');

    log('Importing google-calendar...');
    await import('../server/integrations/google-calendar.js');
    log('Google-calendar imported.');

    log('Importing google-drive...');
    await import('../server/integrations/google-drive.js');
    log('Google-drive imported.');
    
    log('Importing rag-service...');
    await import('../server/services/rag-service.js');
    log('Rag-service imported.');

    log('Importing retrieval-orchestrator...');
    await import('../server/services/retrieval-orchestrator.js');
    log('Retrieval-orchestrator imported.');

    log('Importing rag-dispatcher...');
    await import('../server/services/rag-dispatcher.js');
    log('Rag-dispatcher imported.');

  } catch (e) {
    log(`ERROR: ${e}`);
  }
}

testImports();
