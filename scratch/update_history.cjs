
const fs = require('fs');
const path = require('path');

const filePath = '/Users/jacobseol/Library/CloudStorage/SynologyDrive-DS716p/Antigravity/Mitus_IP_Web/mitus-ip-web/docs/mock-data/SM5720_MOCK_Data.json';
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

const revisions = data.project.project_data.revisions;
const stages = ['EVT0', 'EVT1', 'EVT2', 'EVT3', 'EVT4', 'EVT5'];

const cumulativeHistory = [];

stages.forEach((stage) => {
    if (!revisions[stage]) return;
    
    // Set current historyBlocks from cumulative
    revisions[stage].revisionLog.historyBlocks = JSON.parse(JSON.stringify(cumulativeHistory));
    
    // Add current stage issues to cumulative for NEXT stage
    cumulativeHistory.push({
        stageName: stage,
        issues: JSON.parse(JSON.stringify(revisions[stage].revisionLog.issues || []))
    });
});

fs.writeFileSync(filePath, JSON.stringify(data, null, 4));
console.log('Successfully updated historyBlocks in SM5720_MOCK_Data.json');
