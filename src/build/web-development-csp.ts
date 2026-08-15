const strictStyleDirective = "style-src 'self';"
const developmentStyleDirective = "style-src 'self' 'unsafe-inline';"

export function allowViteDevelopmentStyles(html: string): string {
  if (!html.includes(strictStyleDirective)) {
    throw new Error('Unable to locate the strict style-src directive in index.html')
  }

  return html.replace(strictStyleDirective, developmentStyleDirective)
}
