import { supabase } from '../supabaseClient';
import { projectService } from '../services/projectService';

async function debugProject(projectId) {
    console.log('--- Debugging Project:', projectId, '---');
    const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();
    
    if (error) {
        console.error('Error fetching project:', error);
        return;
    }
    
    console.log('Project Name:', data.name);
    console.log('Is Locked:', data.is_locked);
    console.log('Locked By:', data.locked_by);
    console.log('Current User (from localStorage):', localStorage.getItem('mitus_current_user'));
    
    // Test update
    const testData = { ...data.project_data, debug_timestamp: new Date().toISOString() };
    const result = await projectService.updateProjectData(projectId, testData, new Date().toISOString(), localStorage.getItem('mitus_current_user'));
    console.log('Update Result Error:', result.error);
    console.log('Update Result Count (if any):', result.count);
}

// You can call this from the browser console or by importing it.
window.debugProjectSave = debugProject;
