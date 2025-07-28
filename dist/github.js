"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommentManager = void 0;
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
class CommentManager {
    constructor() {
        this.octokit = github.getOctokit(process.env.GITHUB_TOKEN || '');
    }
    async createOrUpdateComment(body) {
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
            }
            else {
                const response = await this.octokit.rest.issues.createComment({
                    owner: context.repo.owner,
                    repo: context.repo.repo,
                    issue_number: prNumber,
                    body: body
                });
                core.info('Created new DevSecOps PR Gate comment');
                return response.data.html_url;
            }
        }
        catch (error) {
            core.error(`Failed to create/update comment: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }
    async findExistingComment(prNumber, commentTitle) {
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
        }
        catch (error) {
            core.warning(`Failed to find existing comment: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        }
    }
}
exports.CommentManager = CommentManager;
//# sourceMappingURL=github.js.map