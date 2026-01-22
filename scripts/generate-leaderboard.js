const { Octokit } = require('@octokit/rest');
const fs = require('fs');
const path = require('path');

// Configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const TIMEZONE = 'Africa/Lagos'; // WAT

const octokit = new Octokit({ auth: GITHUB_TOKEN });

// Load configuration files
const configDir = path.join(__dirname, '..', 'config');
const membersConfig = JSON.parse(fs.readFileSync(path.join(configDir, 'members.json'), 'utf8'));
const pointsConfig = JSON.parse(fs.readFileSync(path.join(configDir, 'points.json'), 'utf8'));

// Extract whitelisted members (only active and inactive, not alumni)
const WHITELISTED_MEMBERS = membersConfig.members
  .filter(m => !m.status || m.status !== 'alumni')
  .map(m => m.github.toLowerCase());

// Get tracked repositories from environment or config (comma-separated)
const TRACKED_REPOS = (process.env.TRACKED_REPOS || 'stellar-wa/stellar-oss-issues')
  .split(',')
  .map(r => r.trim());

console.log(`Tracking ${WHITELISTED_MEMBERS.length} builders circle members`);
console.log(`Tracking repositories: ${TRACKED_REPOS.join(', ')}`);

// Get current month/year
const now = new Date();
const currentMonth = now.getMonth();
const currentYear = now.getFullYear();
const monthStart = new Date(currentYear, currentMonth, 1);

// Helper to get month name
function getMonthName(date) {
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

// Calculate points from PR
function calculatePoints(pr) {
  const prNumber = pr.number;
  
  // Check for manual override first
  if (pointsConfig.manualOverrides && pointsConfig.manualOverrides[prNumber]) {
    return {
      points: pointsConfig.manualOverrides[prNumber],
      method: 'manual',
      labels: []
    };
  }
  
  // Get label-based points
  const labelPoints = [];
  for (const label of pr.labels) {
    const labelName = label.name.toLowerCase();
    if (pointsConfig.labelPoints[labelName]) {
      labelPoints.push({
        label: labelName,
        points: pointsConfig.labelPoints[labelName]
      });
    }
  }
  
  // Get base points (max from labels, or 2 if no recognized labels)
  const basePoints = labelPoints.length > 0 
    ? Math.max(...labelPoints.map(l => l.points))
    : 2; // Default for unlabeled
  
  // Calculate size multiplier
  const filesChanged = pr.changed_files || 0;
  const linesChanged = (pr.additions || 0) + (pr.deletions || 0);
  
  let sizeMultiplier = 1.0;
  
  // Files multiplier
  const fileMultipliers = pointsConfig.multipliers.filesChanged;
  if (filesChanged >= 21) sizeMultiplier = Math.max(sizeMultiplier, fileMultipliers['21+']);
  else if (filesChanged >= 11) sizeMultiplier = Math.max(sizeMultiplier, fileMultipliers['11-20']);
  else if (filesChanged >= 4) sizeMultiplier = Math.max(sizeMultiplier, fileMultipliers['4-10']);
  
  // Lines multiplier
  const lineMultipliers = pointsConfig.multipliers.linesChanged;
  if (linesChanged >= 501) sizeMultiplier = Math.max(sizeMultiplier, lineMultipliers['501+']);
  else if (linesChanged >= 201) sizeMultiplier = Math.max(sizeMultiplier, lineMultipliers['201-500']);
  else if (linesChanged >= 51) sizeMultiplier = Math.max(sizeMultiplier, lineMultipliers['51-200']);
  
  const finalPoints = Math.round(basePoints * sizeMultiplier);
  
  return {
    points: finalPoints,
    method: 'calculated',
    basePoints,
    multiplier: sizeMultiplier,
    labels: labelPoints,
    filesChanged,
    linesChanged
  };
}

// Fetch all merged PRs for a repository
async function fetchMergedPRs(repoFullName, since) {
  const [owner, repo] = repoFullName.split('/');
  const prs = [];
  let page = 1;
  
  console.log(`Fetching PRs from ${repoFullName}...`);
  
  while (true) {
    try {
      const { data } = await octokit.pulls.list({
        owner,
        repo,
        state: 'closed',
        sort: 'updated',
        direction: 'desc',
        per_page: 100,
        page: page
      });
      
      if (data.length === 0) break;
      
      const mergedPRs = data.filter(pr => {
        if (!pr.merged_at) return false;
        if (new Date(pr.merged_at) < since) return false;
        
        const username = pr.user.login.toLowerCase();
        if (!WHITELISTED_MEMBERS.includes(username)) {
          return false;
        }
        
        return true;
      });
      
      prs.push(...mergedPRs);
      
      // If we got less than 100, we've reached the end
      if (data.length < 100) break;
      page++;
    } catch (error) {
      console.error(`Error fetching from ${repoFullName}:`, error.message);
      break;
    }
  }
  
  console.log(`Found ${prs.length} merged PRs from whitelisted members in ${repoFullName}`);
  return prs;
}

// Main function to generate leaderboard
async function generateLeaderboard() {
  console.log(`Generating leaderboard for ${getMonthName(now)}...`);
  
  const contributors = {};
  const allTimePRs = [];
  const monthlyPRs = [];
  
  // Fetch PRs from all tracked repos
  for (const repoFullName of TRACKED_REPOS) {
    try {
      const monthPRs = await fetchMergedPRs(repoFullName, monthStart);
      const allPRs = await fetchMergedPRs(repoFullName, new Date('2020-01-01')); // All time
      
      // Process monthly PRs
      for (const pr of monthPRs) {
        const username = pr.user.login;
        const pointsResult = calculatePoints(pr);
        const points = pointsResult.points;
        
        console.log(`PR #${pr.number} by @${username}: ${points} points (${pointsResult.method})`);
        
        if (!contributors[username]) {
          contributors[username] = {
            username,
            monthlyPoints: 0,
            monthlyPRs: 0,
            allTimePoints: 0,
            allTimePRs: 0,
            contributions: []
          };
        }
        
        contributors[username].monthlyPoints += points;
        contributors[username].monthlyPRs++;
        contributors[username].contributions.push({
          pr: pr.number,
          repo: repoFullName,
          points,
          method: pointsResult.method
        });
        
        monthlyPRs.push({
          ...pr,
          points,
          repo: repoFullName.split('/')[1],
          repoFull: repoFullName,
          mergedDate: new Date(pr.merged_at),
          pointsDetail: pointsResult
        });
      }
      
      // Process all-time PRs
      for (const pr of allPRs) {
        const username = pr.user.login;
        const pointsResult = calculatePoints(pr);
        const points = pointsResult.points;
        
        if (!contributors[username]) {
          contributors[username] = {
            username,
            monthlyPoints: 0,
            monthlyPRs: 0,
            allTimePoints: 0,
            allTimePRs: 0,
            contributions: []
          };
        }
        
        contributors[username].allTimePoints += points;
        contributors[username].allTimePRs++;
        
        allTimePRs.push({ 
          ...pr, 
          points, 
          repo: repoFullName.split('/')[1],
          repoFull: repoFullName
        });
      }
    } catch (error) {
      console.error(`Error processing ${repoFullName}:`, error.message);
    }
  }
  
  // Sort contributors
  const sortedContributors = Object.values(contributors)
    .sort((a, b) => b.monthlyPoints - a.monthlyPoints);
  
  const allTimeSorted = Object.values(contributors)
    .sort((a, b) => b.allTimePoints - a.allTimePoints);
  
  // Get recent activity
  const recentActivity = monthlyPRs
    .sort((a, b) => b.mergedDate - a.mergedDate)
    .slice(0, 10);
  
  // Generate markdown
  const markdown = generateMarkdown(
    sortedContributors,
    allTimeSorted,
    recentActivity
  );
  
  // Write to file
  const outputPath = path.join(__dirname, '..', 'LEADERBOARD.md');
  fs.writeFileSync(outputPath, markdown);
  
  console.log(`Leaderboard generated successfully at ${outputPath}`);
  console.log(`Total contributors this month: ${sortedContributors.filter(c => c.monthlyPRs > 0).length}`);
  
  // Save raw data as JSON
  const dataPath = path.join(__dirname, '..', 'leaderboard-data.json');
  fs.writeFileSync(dataPath, JSON.stringify({
    generated: now.toISOString(),
    month: getMonthName(now),
    contributors: sortedContributors,
    allTime: allTimeSorted,
    recentActivity
  }, null, 2));
}

function generateMarkdown(monthly, allTime, recent) {
  const medals = ['🥇', '🥈', '🥉'];
  const timestamp = new Date().toLocaleString('en-US', { 
    timeZone: TIMEZONE,
    dateStyle: 'full',
    timeStyle: 'short'
  });
  
  let md = `# Contributor Leaderboard\n\n`;
  md += `Tracking contributions from Stellar WA builders circle members across the Stellar ecosystem.\n\n`;
  md += `**Last Updated**: ${timestamp} WAT\n\n`;
  
  // Monthly Leaderboard
  md += `## Monthly Leaderboard (${getMonthName(now)})\n\n`;
  md += `| Rank | Contributor | Points | PRs |\n`;
  md += `|------|-------------|--------|-----|\n`;
  
  monthly.slice(0, 10).forEach((contributor, index) => {
    if (contributor.monthlyPRs === 0) {
      md += `| ${index + 1} | - | - | - |\n`;
    } else {
      const rank = index < 3 ? `${medals[index]} ${index + 1}` : index + 1;
      md += `| ${rank} | [@${contributor.username}](https://github.com/${contributor.username}) | ${contributor.monthlyPoints} | ${contributor.monthlyPRs} |\n`;
    }
  });
  
  md += `\n**Prize Pool Distribution ($150)**\n`;
  md += `- 🥇 1st place: $75\n`;
  md += `- 🥈 2nd place: $50\n`;
  md += `- 🥉 3rd place: $25\n\n`;
  
  // All-Time Leaderboard
  md += `## All-Time Leaderboard\n\n`;
  md += `| Rank | Contributor | Total Points | Total PRs |\n`;
  md += `|------|-------------|--------------|-----------|\ n`;
  
  allTime.slice(0, 10).forEach((contributor, index) => {
    if (contributor.allTimePRs === 0) {
      md += `| ${index + 1} | - | - | - |\n`;
    } else {
      md += `| ${index + 1} | [@${contributor.username}](https://github.com/${contributor.username}) | ${contributor.allTimePoints} | ${contributor.allTimePRs} |\n`;
    }
  });
  
  // Recent Activity
  md += `\n## Recent Activity\n\n`;
  md += `Last 10 merged PRs:\n\n`;
  md += `| Date | Contributor | Repository | Title | Points |\n`;
  md += `|------|-------------|------------|-------|--------|\n`;
  
  recent.forEach(pr => {
    const date = pr.mergedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const title = pr.title.length > 50 ? pr.title.substring(0, 47) + '...' : pr.title;
    md += `| ${date} | [@${pr.user.login}](https://github.com/${pr.user.login}) | [${pr.repo}](https://github.com/${pr.repoFull}) | [${title}](${pr.html_url}) | ${pr.points} |\n`;
  });
  
  if (recent.length === 0) {
    md += `| - | - | - | - | - |\n`;
  }
  
  // Footer
  md += `\n## Point System\n\n`;
  md += `Points are calculated using:\n`;
  md += `- **Label-based scoring**: Different contribution types earn different base points\n`;
  md += `- **Size multipliers**: Larger contributions get bonus multipliers\n`;
  md += `- **Manual overrides**: Team can assign custom points for exceptional work\n\n`;
  md += `See [\`config/points.json\`](./config/points.json) for full point values.\n\n`;
  
  md += `## Tracked Repositories\n\n`;
  TRACKED_REPOS.forEach(repo => {
    md += `- [${repo}](https://github.com/${repo})\n`;
  });
  
  md += `\n## Leaderboard Rules\n\n`;
  md += `- Only whitelisted builders circle members are tracked\n`;
  md += `- Only merged PRs count toward points\n`;
  md += `- Points calculated from labels, PR size, and manual overrides\n`;
  md += `- Monthly leaderboard resets on the 1st of each month\n`;
  md += `- All-time stats persist across months\n\n`;
  
  md += `---\n\n`;
  md += `*This leaderboard is automatically generated by GitHub Actions. Manual edits will be overwritten.*\n`;
  
  return md;
}

// Run the script
generateLeaderboard().catch(error => {
  console.error('Error generating leaderboard:', error);
  process.exit(1);
});
