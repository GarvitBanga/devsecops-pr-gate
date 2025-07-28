import * as core from '@actions/core';
import * as github from '@actions/github';

export class CommentManager {
  private octokit: ReturnType<typeof github.getOctokit>;

  constructor() {
    this.octokit = github.getOctokit(process.env.GITHUB_TOKEN || '');
  }

  async createOrUpdateComment(body: string): Promise<string> {
    const context = github.context;
    
    if (!context.payload.pull_request) {
      throw new Error('This action must be run on a pull request');
    }

    const prNumber = context.payload.pull_request.number;
    const commentTitle = core.getInput('comment-title', { required: false }) || 'DevSecOps PR Gate';

    try {
      const existingComment = await this.findExistingComment(prNumber, commentTitle);
      
      if (existingComment) {
        await this.octokit.rest.issues.updateComment({
          owner: context.repo.owner,
          repo: context.repo.repo,
          comment_id: existingComment.id,
          body: body
        });
        
        core.info('Updated existing DevSecOps PR Gate comment');
        return existingComment.html_url;
      } else {
        const response = await this.octokit.rest.issues.createComment({
          owner: context.repo.owner,
          repo: context.repo.repo,
          issue_number: prNumber,
          body: body
        });
        
        core.info('Created new DevSecOps PR Gate comment');
        return response.data.html_url;
      }
    } catch (error) {
      core.error(`Failed to create/update comment: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  private async findExistingComment(prNumber: number, commentTitle: string): Promise<{ id: number; html_url: string } | null> {
    const context = github.context;
    
    try {
      const comments = await this.octokit.rest.issues.listComments({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: prNumber
      });

      for (const comment of comments.data) {
        if (comment.body && comment.body.includes(commentTitle)) {
          return {
            id: comment.id,
            html_url: comment.html_url
          };
        }
      }
      
      return null;
    } catch (error) {
      core.warning(`Failed to find existing comment: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }
} 