export function canPublish(article: { status: string; reviewers: { approved: boolean }[] }): boolean {
  return article.status === 'draft'
    && article.reviewers.every(reviewer => reviewer.approved)
}
