/**
 * =============================================================================
 * GITHUB INTEGRATION
 * =============================================================================
 * 
 * Provides access to GitHub repositories, issues, pull requests, and code.
 * Uses Replit's GitHub connector for OAuth authentication.
 * 
 * CAPABILITIES:
 * - List and search repositories
 * - Read repository contents (files, directories)
 * - Manage issues (list, create, update, close)
 * - View pull requests
 * - Search code across repositories
 * - Get commit history
 * =============================================================================
 */

import { Octokit } from '@octokit/rest';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings?.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('GitHub not connected. Please connect your GitHub account.');
  }
  return accessToken;
}

export async function getUncachableGitHubClient() {
  const accessToken = await getAccessToken();
  return new Octokit({ auth: accessToken });
}

// ═══════════════════════════════════════════════════════════════════════════
// REPOSITORY OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

export async function listUserRepos(perPage = 30, page = 1, sort: 'created' | 'updated' | 'pushed' | 'full_name' = 'updated') {
  try {
    const octokit = await getUncachableGitHubClient();
    const { data } = await octokit.repos.listForAuthenticatedUser({
      per_page: perPage,
      page,
      sort,
      direction: 'desc'
    });
    
    return data.map(repo => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      private: repo.private,
      htmlUrl: repo.html_url,
      cloneUrl: repo.clone_url,
      language: repo.language,
      stargazersCount: repo.stargazers_count,
      forksCount: repo.forks_count,
      openIssuesCount: repo.open_issues_count,
      defaultBranch: repo.default_branch,
      createdAt: repo.created_at,
      updatedAt: repo.updated_at,
      pushedAt: repo.pushed_at
    }));
  } catch (error: any) {
    console.error('[GitHub] listUserRepos error:', error);
    return {
      success: false,
      error: error.message || 'Failed to list user repositories',
      statusCode: error.status,
      operation: 'listUserRepos',
      params: { perPage, page, sort }
    };
  }
}

export async function getRepo(owner: string, repo: string) {
  try {
    const octokit = await getUncachableGitHubClient();
    const { data } = await octokit.repos.get({ owner, repo });
    
    return {
      id: data.id,
      name: data.name,
      fullName: data.full_name,
      description: data.description,
      private: data.private,
      htmlUrl: data.html_url,
      cloneUrl: data.clone_url,
      language: data.language,
      stargazersCount: data.stargazers_count,
      forksCount: data.forks_count,
      openIssuesCount: data.open_issues_count,
      defaultBranch: data.default_branch,
      topics: data.topics,
      license: data.license?.name,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      pushedAt: data.pushed_at
    };
  } catch (error: any) {
    console.error('[GitHub] getRepo error:', error);
    return {
      success: false,
      error: error.message || `Failed to get repository ${owner}/${repo}`,
      statusCode: error.status,
      operation: 'getRepo',
      params: { owner, repo }
    };
  }
}

export async function createRepo(name: string, options: { description?: string; isPrivate?: boolean; autoInit?: boolean } = {}) {
  try {
    const octokit = await getUncachableGitHubClient();
    const { data } = await octokit.repos.createForAuthenticatedUser({
      name,
      description: options.description || '',
      private: options.isPrivate || false,
      auto_init: options.autoInit !== false
    });
    
    return {
      id: data.id,
      name: data.name,
      fullName: data.full_name,
      description: data.description,
      private: data.private,
      htmlUrl: data.html_url,
      cloneUrl: data.clone_url,
      sshUrl: data.ssh_url,
      defaultBranch: data.default_branch,
      createdAt: data.created_at
    };
  } catch (error: any) {
    console.error('[GitHub] createRepo error:', error);
    return {
      success: false,
      error: error.message || `Failed to create repository ${name}`,
      statusCode: error.status,
      operation: 'createRepo',
      params: { name, options }
    };
  }
}

export async function searchRepos(query: string, perPage = 10) {
  try {
    const octokit = await getUncachableGitHubClient();
    const { data } = await octokit.search.repos({
      q: query,
      per_page: perPage,
      sort: 'stars',
      order: 'desc'
    });
    
    return {
      totalCount: data.total_count,
      repos: data.items.map(repo => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description,
        private: repo.private,
        htmlUrl: repo.html_url,
        language: repo.language,
        stargazersCount: repo.stargazers_count,
        forksCount: repo.forks_count
      }))
    };
  } catch (error: any) {
    console.error('[GitHub] searchRepos error:', error);
    return {
      success: false,
      error: error.message || `Failed to search repositories with query: ${query}`,
      statusCode: error.status,
      operation: 'searchRepos',
      params: { query, perPage }
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FILE/CONTENT OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

export async function getRepoContents(owner: string, repo: string, path = '', ref?: string) {
  try {
    const octokit = await getUncachableGitHubClient();
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path,
      ref
    });
    
    if (Array.isArray(data)) {
      return data.map(item => ({
        name: item.name,
        path: item.path,
        type: item.type,
        size: item.size,
        sha: item.sha,
        htmlUrl: item.html_url
      }));
    } else {
      return {
        name: data.name,
        path: data.path,
        type: data.type,
        size: data.size,
        sha: data.sha,
        htmlUrl: data.html_url,
        content: 'content' in data ? Buffer.from(data.content, 'base64').toString('utf-8') : null,
        encoding: 'encoding' in data ? data.encoding : null
      };
    }
  } catch (error: any) {
    console.error('[GitHub] getRepoContents error:', error);
    return {
      success: false,
      error: error.message || `Failed to get contents for ${owner}/${repo}/${path}`,
      statusCode: error.status,
      operation: 'getRepoContents',
      params: { owner, repo, path, ref }
    };
  }
}

export async function getFileContent(owner: string, repo: string, path: string, ref?: string) {
  try {
    const octokit = await getUncachableGitHubClient();
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path,
      ref
    });
    
    if (Array.isArray(data)) {
      return {
        success: false,
        error: `Path "${path}" is a directory, not a file`,
        operation: 'getFileContent',
        params: { owner, repo, path, ref }
      };
    }
    
    if (!('content' in data)) {
      return {
        success: false,
        error: `Cannot read content of "${path}"`,
        operation: 'getFileContent',
        params: { owner, repo, path, ref }
      };
    }
    
    return {
      name: data.name,
      path: data.path,
      sha: data.sha,
      size: data.size,
      content: Buffer.from(data.content, 'base64').toString('utf-8'),
      htmlUrl: data.html_url
    };
  } catch (error: any) {
    console.error('[GitHub] getFileContent error:', error);
    return {
      success: false,
      error: error.message || `Failed to get file content for ${owner}/${repo}/${path}`,
      statusCode: error.status,
      operation: 'getFileContent',
      params: { owner, repo, path, ref }
    };
  }
}

export async function searchCode(query: string, perPage = 10) {
  try {
    const octokit = await getUncachableGitHubClient();
    const { data } = await octokit.search.code({
      q: query,
      per_page: perPage
    });
    
    return {
      totalCount: data.total_count,
      items: data.items.map(item => ({
        name: item.name,
        path: item.path,
        sha: item.sha,
        htmlUrl: item.html_url,
        repository: {
          fullName: item.repository.full_name,
          description: item.repository.description
        }
      }))
    };
  } catch (error: any) {
    console.error('[GitHub] searchCode error:', error);
    return {
      success: false,
      error: error.message || `Failed to search code with query: ${query}`,
      statusCode: error.status,
      operation: 'searchCode',
      params: { query, perPage }
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ISSUE OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

export async function listIssues(owner: string, repo: string, state: 'open' | 'closed' | 'all' = 'open', perPage = 30) {
  try {
    const octokit = await getUncachableGitHubClient();
    const { data } = await octokit.issues.listForRepo({
      owner,
      repo,
      state,
      per_page: perPage,
      sort: 'updated',
      direction: 'desc'
    });
    
    return data.filter(issue => !issue.pull_request).map(issue => ({
      id: issue.id,
      number: issue.number,
      title: issue.title,
      body: issue.body,
      state: issue.state,
      htmlUrl: issue.html_url,
      user: issue.user?.login,
      labels: issue.labels.map(l => typeof l === 'string' ? l : l.name),
      assignees: issue.assignees?.map(a => a.login),
      createdAt: issue.created_at,
      updatedAt: issue.updated_at,
      closedAt: issue.closed_at
    }));
  } catch (error: any) {
    console.error('[GitHub] listIssues error:', error);
    return {
      success: false,
      error: error.message || `Failed to list issues for ${owner}/${repo}`,
      statusCode: error.status,
      operation: 'listIssues',
      params: { owner, repo, state, perPage }
    };
  }
}

export async function getIssue(owner: string, repo: string, issueNumber: number) {
  try {
    const octokit = await getUncachableGitHubClient();
    const { data: issue } = await octokit.issues.get({
      owner,
      repo,
      issue_number: issueNumber
    });
    
    return {
      id: issue.id,
      number: issue.number,
      title: issue.title,
      body: issue.body,
      state: issue.state,
      htmlUrl: issue.html_url,
      user: issue.user?.login,
      labels: issue.labels.map(l => typeof l === 'string' ? l : l.name),
      assignees: issue.assignees?.map(a => a.login),
      milestone: issue.milestone?.title,
      createdAt: issue.created_at,
      updatedAt: issue.updated_at,
      closedAt: issue.closed_at
    };
  } catch (error: any) {
    console.error('[GitHub] getIssue error:', error);
    return {
      success: false,
      error: error.message || `Failed to get issue #${issueNumber} from ${owner}/${repo}`,
      statusCode: error.status,
      operation: 'getIssue',
      params: { owner, repo, issueNumber }
    };
  }
}

export async function createIssue(owner: string, repo: string, title: string, body?: string, labels?: string[], assignees?: string[], milestone?: number) {
  try {
    const octokit = await getUncachableGitHubClient();
    const { data: issue } = await octokit.issues.create({
      owner,
      repo,
      title,
      body,
      labels,
      assignees,
      milestone
    });
    
    return {
      id: issue.id,
      number: issue.number,
      title: issue.title,
      htmlUrl: issue.html_url,
      state: issue.state,
      labels: issue.labels.map(l => typeof l === 'string' ? l : l.name),
      assignees: issue.assignees?.map(a => a.login),
      milestone: issue.milestone?.title,
      createdAt: issue.created_at
    };
  } catch (error: any) {
    console.error('[GitHub] createIssue error:', error);
    return {
      success: false,
      error: error.message || `Failed to create issue in ${owner}/${repo}`,
      statusCode: error.status,
      operation: 'createIssue',
      params: { owner, repo, title }
    };
  }
}

export async function updateIssue(owner: string, repo: string, issueNumber: number, updates: { title?: string; body?: string; state?: 'open' | 'closed'; labels?: string[]; assignees?: string[]; milestone?: number | null }) {
  try {
    const octokit = await getUncachableGitHubClient();
    const { data: issue } = await octokit.issues.update({
      owner,
      repo,
      issue_number: issueNumber,
      ...updates
    });
    
    return {
      id: issue.id,
      number: issue.number,
      title: issue.title,
      state: issue.state,
      htmlUrl: issue.html_url,
      labels: issue.labels.map(l => typeof l === 'string' ? l : l.name),
      assignees: issue.assignees?.map(a => a.login),
      milestone: issue.milestone?.title,
      updatedAt: issue.updated_at
    };
  } catch (error: any) {
    console.error('[GitHub] updateIssue error:', error);
    return {
      success: false,
      error: error.message || `Failed to update issue #${issueNumber} in ${owner}/${repo}`,
      statusCode: error.status,
      operation: 'updateIssue',
      params: { owner, repo, issueNumber, updates }
    };
  }
}

export async function listMilestones(owner: string, repo: string, state: 'open' | 'closed' | 'all' = 'open') {
  try {
    const octokit = await getUncachableGitHubClient();
    const { data } = await octokit.issues.listMilestones({
      owner,
      repo,
      state
    });
    
    return data.map(m => ({
      number: m.number,
      title: m.title,
      description: m.description,
      state: m.state,
      openIssues: m.open_issues,
      closedIssues: m.closed_issues,
      dueOn: m.due_on
    }));
  } catch (error: any) {
    console.error('[GitHub] listMilestones error:', error);
    return {
      success: false,
      error: error.message || `Failed to list milestones for ${owner}/${repo}`,
      statusCode: error.status,
      operation: 'listMilestones',
      params: { owner, repo, state }
    };
  }
}

export async function listLabels(owner: string, repo: string) {
  try {
    const octokit = await getUncachableGitHubClient();
    const { data } = await octokit.issues.listLabelsForRepo({
      owner,
      repo,
      per_page: 100
    });
    
    return data.map(l => ({
      name: l.name,
      color: l.color,
      description: l.description
    }));
  } catch (error: any) {
    console.error('[GitHub] listLabels error:', error);
    return {
      success: false,
      error: error.message || `Failed to list labels for ${owner}/${repo}`,
      statusCode: error.status,
      operation: 'listLabels',
      params: { owner, repo }
    };
  }
}

export async function addIssueComment(owner: string, repo: string, issueNumber: number, body: string) {
  try {
    const octokit = await getUncachableGitHubClient();
    const { data: comment } = await octokit.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body
    });
    
    return {
      id: comment.id,
      body: comment.body,
      user: comment.user?.login,
      htmlUrl: comment.html_url,
      createdAt: comment.created_at
    };
  } catch (error: any) {
    console.error('[GitHub] addIssueComment error:', error);
    return {
      success: false,
      error: error.message || `Failed to add comment to issue #${issueNumber} in ${owner}/${repo}`,
      statusCode: error.status,
      operation: 'addIssueComment',
      params: { owner, repo, issueNumber }
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PULL REQUEST OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

export async function listPullRequests(owner: string, repo: string, state: 'open' | 'closed' | 'all' = 'open', perPage = 30) {
  try {
    const octokit = await getUncachableGitHubClient();
    const { data } = await octokit.pulls.list({
      owner,
      repo,
      state,
      per_page: perPage,
      sort: 'updated',
      direction: 'desc'
    });
    
    return data.map(pr => ({
      id: pr.id,
      number: pr.number,
      title: pr.title,
      body: pr.body,
      state: pr.state,
      htmlUrl: pr.html_url,
      user: pr.user?.login,
      head: pr.head.ref,
      base: pr.base.ref,
      draft: pr.draft,
      merged: pr.merged_at !== null,
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
      mergedAt: pr.merged_at
    }));
  } catch (error: any) {
    console.error('[GitHub] listPullRequests error:', error);
    return {
      success: false,
      error: error.message || `Failed to list pull requests for ${owner}/${repo}`,
      statusCode: error.status,
      operation: 'listPullRequests',
      params: { owner, repo, state, perPage }
    };
  }
}

export async function getPullRequest(owner: string, repo: string, pullNumber: number) {
  try {
    const octokit = await getUncachableGitHubClient();
    const { data: pr } = await octokit.pulls.get({
      owner,
      repo,
      pull_number: pullNumber
    });
    
    return {
      id: pr.id,
      number: pr.number,
      title: pr.title,
      body: pr.body,
      state: pr.state,
      htmlUrl: pr.html_url,
      user: pr.user?.login,
      head: pr.head.ref,
      base: pr.base.ref,
      draft: pr.draft,
      merged: pr.merged,
      mergeable: pr.mergeable,
      additions: pr.additions,
      deletions: pr.deletions,
      changedFiles: pr.changed_files,
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
      mergedAt: pr.merged_at
    };
  } catch (error: any) {
    console.error('[GitHub] getPullRequest error:', error);
    return {
      success: false,
      error: error.message || `Failed to get pull request #${pullNumber} from ${owner}/${repo}`,
      statusCode: error.status,
      operation: 'getPullRequest',
      params: { owner, repo, pullNumber }
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// COMMIT OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

export async function listCommits(owner: string, repo: string, sha?: string, perPage = 30) {
  try {
    const octokit = await getUncachableGitHubClient();
    const { data } = await octokit.repos.listCommits({
      owner,
      repo,
      sha,
      per_page: perPage
    });
    
    return data.map(commit => ({
      sha: commit.sha,
      message: commit.commit.message,
      author: commit.commit.author?.name,
      authorEmail: commit.commit.author?.email,
      date: commit.commit.author?.date,
      htmlUrl: commit.html_url
    }));
  } catch (error: any) {
    console.error('[GitHub] listCommits error:', error);
    return {
      success: false,
      error: error.message || `Failed to list commits for ${owner}/${repo}`,
      statusCode: error.status,
      operation: 'listCommits',
      params: { owner, repo, sha, perPage }
    };
  }
}

export async function getCommit(owner: string, repo: string, sha: string) {
  try {
    const octokit = await getUncachableGitHubClient();
    const { data: commit } = await octokit.repos.getCommit({
      owner,
      repo,
      ref: sha
    });
    
    return {
      sha: commit.sha,
      message: commit.commit.message,
      author: commit.commit.author?.name,
      authorEmail: commit.commit.author?.email,
      date: commit.commit.author?.date,
      htmlUrl: commit.html_url,
      stats: commit.stats,
      files: commit.files?.map(f => ({
        filename: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
        changes: f.changes,
        patch: f.patch
      }))
    };
  } catch (error: any) {
    console.error('[GitHub] getCommit error:', error);
    return {
      success: false,
      error: error.message || `Failed to get commit ${sha} from ${owner}/${repo}`,
      statusCode: error.status,
      operation: 'getCommit',
      params: { owner, repo, sha }
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// BRANCH OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

export async function listBranches(owner: string, repo: string, perPage = 100) {
  try {
    const octokit = await getUncachableGitHubClient();
    const { data } = await octokit.repos.listBranches({
      owner,
      repo,
      per_page: perPage
    });
    
    return data.map(branch => ({
      name: branch.name,
      sha: branch.commit.sha,
      protected: branch.protected
    }));
  } catch (error: any) {
    console.error('[GitHub] listBranches error:', error);
    return {
      success: false,
      error: error.message || `Failed to list branches for ${owner}/${repo}`,
      statusCode: error.status,
      operation: 'listBranches',
      params: { owner, repo, perPage }
    };
  }
}

export async function deleteBranch(owner: string, repo: string, branchName: string) {
  try {
    const octokit = await getUncachableGitHubClient();
    await octokit.git.deleteRef({
      owner,
      repo,
      ref: `heads/${branchName}`
    });
    
    return { success: true, deletedBranch: branchName };
  } catch (error: any) {
    console.error('[GitHub] deleteBranch error:', error);
    return {
      success: false,
      error: error.message || `Failed to delete branch ${branchName} from ${owner}/${repo}`,
      statusCode: error.status,
      operation: 'deleteBranch',
      params: { owner, repo, branchName }
    };
  }
}

export async function getDefaultBranch(owner: string, repo: string): Promise<string | { success: false; error: string; statusCode?: number; operation: string; params: any }> {
  try {
    const octokit = await getUncachableGitHubClient();
    const { data } = await octokit.repos.get({ owner, repo });
    return data.default_branch;
  } catch (error: any) {
    console.error('[GitHub] getDefaultBranch error:', error);
    return {
      success: false,
      error: error.message || `Failed to get default branch for ${owner}/${repo}`,
      statusCode: error.status,
      operation: 'getDefaultBranch',
      params: { owner, repo }
    };
  }
}

export async function createBranch(owner: string, repo: string, branchName: string, fromBranch?: string) {
  try {
    const octokit = await getUncachableGitHubClient();
    const baseBranch = fromBranch || await getDefaultBranch(owner, repo);
    
    // Check if getDefaultBranch returned an error
    if (typeof baseBranch === 'object' && 'success' in baseBranch && baseBranch.success === false) {
      return baseBranch;
    }
    
    const { data: ref } = await octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${baseBranch}`
    });
    
    await octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha: ref.object.sha
    });
    
    return { name: branchName, sha: ref.object.sha, baseBranch };
  } catch (error: any) {
    console.error('[GitHub] createBranch error:', error);
    return {
      success: false,
      error: error.message || `Failed to create branch ${branchName} in ${owner}/${repo}`,
      statusCode: error.status,
      operation: 'createBranch',
      params: { owner, repo, branchName, fromBranch }
    };
  }
}

export async function createOrUpdateFile(
  owner: string, 
  repo: string, 
  path: string, 
  content: string, 
  message: string,
  branch: string,
  sha?: string
) {
  try {
    const octokit = await getUncachableGitHubClient();
    
    let existingSha = sha;
    if (!existingSha) {
      try {
        const { data } = await octokit.repos.getContent({ owner, repo, path, ref: branch });
        if (!Array.isArray(data) && 'sha' in data) {
          existingSha = data.sha;
        }
      } catch (e: any) {
        // 404 errors are expected when checking if a file exists before creating it
        // We can safely ignore them and proceed with file creation
        if (e.status !== 404) {
          console.error('[GitHub] createOrUpdateFile getContent error:', e);
          return {
            success: false,
            error: e.message || 'Failed to check if file exists',
            statusCode: e.status,
            operation: 'createOrUpdateFile',
            params: { owner, repo, path, branch }
          };
        }
      }
    }
    
    const { data } = await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message,
      content: Buffer.from(content).toString('base64'),
      branch,
      sha: existingSha
    });
    
    return {
      path: data.content?.path,
      sha: data.content?.sha,
      htmlUrl: data.content?.html_url,
      commitSha: data.commit.sha,
      commitUrl: data.commit.html_url
    };
  } catch (error: any) {
    console.error('[GitHub] createOrUpdateFile error:', error);
    return {
      success: false,
      error: error.message || `Failed to create/update file ${path} in ${owner}/${repo}`,
      statusCode: error.status,
      operation: 'createOrUpdateFile',
      params: { owner, repo, path, branch }
    };
  }
}

/**
 * Creates a new file (wrapper around createOrUpdateFile for clarity)
 * This will fail if the file already exists
 */
export async function createFile(
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  branch: string
) {
  return createOrUpdateFile(owner, repo, path, content, message, branch);
}

export async function createPullRequest(
  owner: string,
  repo: string,
  title: string,
  body: string,
  head: string,
  base?: string,
  draft = false
) {
  try {
    const octokit = await getUncachableGitHubClient();
    const baseBranch = base || await getDefaultBranch(owner, repo);
    
    // Check if getDefaultBranch returned an error
    if (typeof baseBranch === 'object' && 'success' in baseBranch && baseBranch.success === false) {
      return baseBranch;
    }
    
    const { data: pr } = await octokit.pulls.create({
      owner,
      repo,
      title,
      body,
      head,
      base: baseBranch,
      draft
    });
    
    return {
      id: pr.id,
      number: pr.number,
      title: pr.title,
      body: pr.body,
      state: pr.state,
      htmlUrl: pr.html_url,
      head: pr.head.ref,
      base: pr.base.ref,
      draft: pr.draft,
      createdAt: pr.created_at
    };
  } catch (error: any) {
    console.error('[GitHub] createPullRequest error:', error);
    return {
      success: false,
      error: error.message || `Failed to create pull request in ${owner}/${repo}`,
      statusCode: error.status,
      operation: 'createPullRequest',
      params: { owner, repo, title, head, base }
    };
  }
}

export async function mergePullRequest(
  owner: string,
  repo: string,
  pullNumber: number,
  options: { commitTitle?: string; commitMessage?: string; mergeMethod?: 'merge' | 'squash' | 'rebase' } = {}
) {
  try {
    const octokit = await getUncachableGitHubClient();
    const { data } = await octokit.pulls.merge({
      owner,
      repo,
      pull_number: pullNumber,
      commit_title: options.commitTitle,
      commit_message: options.commitMessage,
      merge_method: options.mergeMethod || 'merge'
    });
    
    return {
      merged: data.merged,
      sha: data.sha,
      message: data.message
    };
  } catch (error: any) {
    console.error('[GitHub] mergePullRequest error:', error);
    return {
      success: false,
      error: error.message || `Failed to merge pull request #${pullNumber} in ${owner}/${repo}`,
      statusCode: error.status,
      operation: 'mergePullRequest',
      params: { owner, repo, pullNumber, options }
    };
  }
}

export async function requestReviewers(
  owner: string,
  repo: string,
  pullNumber: number,
  reviewers: string[],
  teamReviewers?: string[]
) {
  try {
    const octokit = await getUncachableGitHubClient();
    const { data: pr } = await octokit.pulls.requestReviewers({
      owner,
      repo,
      pull_number: pullNumber,
      reviewers,
      team_reviewers: teamReviewers
    });
    
    return {
      number: pr.number,
      title: pr.title,
      requestedReviewers: pr.requested_reviewers?.map(r => r.login),
      requestedTeams: pr.requested_teams?.map(t => t.name),
      htmlUrl: pr.html_url
    };
  } catch (error: any) {
    console.error('[GitHub] requestReviewers error:', error);
    return {
      success: false,
      error: error.message || `Failed to request reviewers for PR #${pullNumber} in ${owner}/${repo}`,
      statusCode: error.status,
      operation: 'requestReviewers',
      params: { owner, repo, pullNumber, reviewers, teamReviewers }
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// REPOSITORY OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

export async function forkRepo(owner: string, repo: string, organization?: string, name?: string) {
  try {
    const octokit = await getUncachableGitHubClient();
    const { data: fork } = await octokit.repos.createFork({
      owner,
      repo,
      organization,
      name
    });
    
    return {
      id: fork.id,
      name: fork.name,
      fullName: fork.full_name,
      htmlUrl: fork.html_url,
      cloneUrl: fork.clone_url,
      defaultBranch: fork.default_branch,
      owner: fork.owner.login,
      parent: fork.parent ? { owner: fork.parent.owner.login, repo: fork.parent.name } : null
    };
  } catch (error: any) {
    console.error('[GitHub] forkRepo error:', error);
    return {
      success: false,
      error: error.message || `Failed to fork repository ${owner}/${repo}`,
      statusCode: error.status,
      operation: 'forkRepo',
      params: { owner, repo, organization, name }
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// RELEASE OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

export async function createRelease(
  owner: string,
  repo: string,
  tagName: string,
  options: { name?: string; body?: string; draft?: boolean; prerelease?: boolean; targetCommitish?: string } = {}
) {
  try {
    const octokit = await getUncachableGitHubClient();
    const { data: release } = await octokit.repos.createRelease({
      owner,
      repo,
      tag_name: tagName,
      name: options.name || tagName,
      body: options.body,
      draft: options.draft || false,
      prerelease: options.prerelease || false,
      target_commitish: options.targetCommitish
    });
    
    return {
      id: release.id,
      tagName: release.tag_name,
      name: release.name,
      body: release.body,
      draft: release.draft,
      prerelease: release.prerelease,
      htmlUrl: release.html_url,
      createdAt: release.created_at,
      publishedAt: release.published_at
    };
  } catch (error: any) {
    console.error('[GitHub] createRelease error:', error);
    return {
      success: false,
      error: error.message || `Failed to create release ${tagName} in ${owner}/${repo}`,
      statusCode: error.status,
      operation: 'createRelease',
      params: { owner, repo, tagName, options }
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GITHUB ACTIONS OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

export async function triggerWorkflow(
  owner: string,
  repo: string,
  workflowId: string | number,
  ref: string,
  inputs?: Record<string, string>
) {
  try {
    const octokit = await getUncachableGitHubClient();
    await octokit.actions.createWorkflowDispatch({
      owner,
      repo,
      workflow_id: workflowId,
      ref,
      inputs
    });
    
    return {
      triggered: true,
      workflowId,
      ref,
      inputs
    };
  } catch (error: any) {
    console.error('[GitHub] triggerWorkflow error:', error);
    return {
      success: false,
      error: error.message || `Failed to trigger workflow ${workflowId} in ${owner}/${repo}`,
      statusCode: error.status,
      operation: 'triggerWorkflow',
      params: { owner, repo, workflowId, ref, inputs }
    };
  }
}

export async function listWorkflows(owner: string, repo: string) {
  try {
    const octokit = await getUncachableGitHubClient();
    const { data } = await octokit.actions.listRepoWorkflows({
      owner,
      repo
    });
    
    return data.workflows.map(w => ({
      id: w.id,
      name: w.name,
      path: w.path,
      state: w.state,
      htmlUrl: w.html_url
    }));
  } catch (error: any) {
    console.error('[GitHub] listWorkflows error:', error);
    return {
      success: false,
      error: error.message || `Failed to list workflows for ${owner}/${repo}`,
      statusCode: error.status,
      operation: 'listWorkflows',
      params: { owner, repo }
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// USER OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

export async function getAuthenticatedUser() {
  try {
    const octokit = await getUncachableGitHubClient();
    const { data: user } = await octokit.users.getAuthenticated();
    
    return {
      id: user.id,
      login: user.login,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatar_url,
      htmlUrl: user.html_url,
      bio: user.bio,
      company: user.company,
      location: user.location,
      publicRepos: user.public_repos,
      followers: user.followers,
      following: user.following,
      createdAt: user.created_at
    };
  } catch (error: any) {
    console.error('[GitHub] getAuthenticatedUser error:', error);
    return {
      success: false,
      error: error.message || 'Failed to get authenticated user',
      statusCode: error.status,
      operation: 'getAuthenticatedUser'
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// AGENT ATTRIBUTION SUPPORT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Agent author information for Git commits
 */
export interface AgentAuthor {
  name: string;      // e.g., "Agentia Compiler"
  email: string;     // e.g., "compiler@agentia.dev"
  signature?: string; // Optional signature to add to commit messages
}

/**
 * Creates or updates a file with custom agent author attribution
 * This uses the Git Data API to create a commit with custom author information
 */
export async function createOrUpdateFileWithAgent(
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  branch: string,
  agent: AgentAuthor,
  sha?: string
): Promise<{
  path: string | undefined;
  sha: string | undefined;
  htmlUrl: string | undefined;
  commitSha: string;
  commitUrl: string | undefined;
} | {
  success: false;
  error: string;
  statusCode?: number;
  operation: string;
  params: any;
}> {
  try {
    const octokit = await getUncachableGitHubClient();
    
    // Get the current commit of the branch
    const { data: refData } = await octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`
    });
    const latestCommitSha = refData.object.sha;
    
    // Get the tree of the latest commit
    const { data: commitData } = await octokit.git.getCommit({
      owner,
      repo,
      commit_sha: latestCommitSha
    });
    const baseTreeSha = commitData.tree.sha;
    
    // Create a blob for the file content
    const { data: blobData } = await octokit.git.createBlob({
      owner,
      repo,
      content: Buffer.from(content).toString('base64'),
      encoding: 'base64'
    });
    
    // Create a new tree with the file
    const { data: treeData } = await octokit.git.createTree({
      owner,
      repo,
      base_tree: baseTreeSha,
      tree: [
        {
          path,
          mode: '100644',
          type: 'blob',
          sha: blobData.sha
        }
      ]
    });
    
    // Add agent signature to commit message if provided
    const commitMessage = agent.signature 
      ? `${message}\n\n---\n${agent.signature}`
      : message;
    
    // Create a commit with custom author
    const { data: newCommit } = await octokit.git.createCommit({
      owner,
      repo,
      message: commitMessage,
      tree: treeData.sha,
      parents: [latestCommitSha],
      author: {
        name: agent.name,
        email: agent.email,
        date: new Date().toISOString()
      }
    });
    
    // Update the reference to point to the new commit
    await octokit.git.updateRef({
      owner,
      repo,
      ref: `heads/${branch}`,
      sha: newCommit.sha
    });
    
    return {
      path,
      sha: blobData.sha,
      htmlUrl: `https://github.com/${owner}/${repo}/blob/${branch}/${path}`,
      commitSha: newCommit.sha,
      commitUrl: newCommit.html_url
    };
  } catch (error: any) {
    console.error('[GitHub] createOrUpdateFileWithAgent error:', error);
    return {
      success: false,
      error: error.message || `Failed to create/update file ${path} with agent in ${owner}/${repo}`,
      statusCode: error.status,
      operation: 'createOrUpdateFileWithAgent',
      params: { owner, repo, path, branch, agent: agent.name }
    };
  }
}

/**
 * Creates a pull request with agent attribution in the body
 */
export async function createPullRequestWithAgent(
  owner: string,
  repo: string,
  title: string,
  body: string,
  head: string,
  agent: AgentAuthor,
  base?: string,
  draft = false
) {
  try {
    const octokit = await getUncachableGitHubClient();
    const baseBranch = base || await getDefaultBranch(owner, repo);
    
    // Check if getDefaultBranch returned an error
    if (typeof baseBranch === 'object' && 'success' in baseBranch && baseBranch.success === false) {
      return baseBranch;
    }
    
    // Add agent attribution to PR body
    const attributedBody = `${body}\n\n---\n*Created by: **${agent.name}** (${agent.email})*`;
    
    const { data: pr } = await octokit.pulls.create({
      owner,
      repo,
      title,
      body: attributedBody,
      head,
      base: baseBranch,
      draft
    });
    
    return {
      id: pr.id,
      number: pr.number,
      title: pr.title,
      body: pr.body,
      state: pr.state,
      htmlUrl: pr.html_url,
      head: pr.head.ref,
      base: pr.base.ref,
      draft: pr.draft,
      createdAt: pr.created_at
    };
  } catch (error: any) {
    console.error('[GitHub] createPullRequestWithAgent error:', error);
    return {
      success: false,
      error: error.message || `Failed to create pull request with agent in ${owner}/${repo}`,
      statusCode: error.status,
      operation: 'createPullRequestWithAgent',
      params: { owner, repo, title, head, base, agent: agent.name }
    };
  }
}

/**
 * Creates an issue with agent attribution
 */
export async function createIssueWithAgent(
  owner: string,
  repo: string,
  title: string,
  agent: AgentAuthor,
  body?: string,
  labels?: string[],
  assignees?: string[]
) {
  try {
    const octokit = await getUncachableGitHubClient();
    
    // Add agent attribution to issue body
    const attributedBody = body 
      ? `${body}\n\n---\n*Created by: **${agent.name}** (${agent.email})*`
      : `*Created by: **${agent.name}** (${agent.email})*`;
    
    const { data: issue } = await octokit.issues.create({
      owner,
      repo,
      title,
      body: attributedBody,
      labels,
      assignees
    });
    
    return {
      id: issue.id,
      number: issue.number,
      title: issue.title,
      htmlUrl: issue.html_url,
      state: issue.state,
      createdAt: issue.created_at
    };
  } catch (error: any) {
    console.error('[GitHub] createIssueWithAgent error:', error);
    return {
      success: false,
      error: error.message || `Failed to create issue with agent in ${owner}/${repo}`,
      statusCode: error.status,
      operation: 'createIssueWithAgent',
      params: { owner, repo, title, agent: agent.name }
    };
  }
}

/**
 * Adds a comment to an issue or PR with agent attribution
 */
export async function addCommentWithAgent(
  owner: string,
  repo: string,
  issueNumber: number,
  body: string,
  agent: AgentAuthor
) {
  try {
    const octokit = await getUncachableGitHubClient();
    
    // Add agent attribution to comment
    const attributedBody = `${body}\n\n---\n*Posted by: **${agent.name}** (${agent.email})*`;
    
    const { data: comment } = await octokit.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body: attributedBody
    });
    
    return {
      id: comment.id,
      body: comment.body,
      user: comment.user?.login,
      htmlUrl: comment.html_url,
      createdAt: comment.created_at
    };
  } catch (error: any) {
    console.error('[GitHub] addCommentWithAgent error:', error);
    return {
      success: false,
      error: error.message || `Failed to add comment with agent to issue #${issueNumber} in ${owner}/${repo}`,
      statusCode: error.status,
      operation: 'addCommentWithAgent',
      params: { owner, repo, issueNumber, agent: agent.name }
    };
  }
}
