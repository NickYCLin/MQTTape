import { describe, expect, it } from 'vitest'
import { allowViteDevelopmentStyles } from './web-development-csp'

describe('allowViteDevelopmentStyles', () => {
  it('allows inline styles without weakening the script policy', () => {
    const html = `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:">`

    const result = allowViteDevelopmentStyles(html)

    expect(result).toContain("style-src 'self' 'unsafe-inline';")
    expect(result).toContain("script-src 'self';")
    expect(result).not.toContain("script-src 'self' 'unsafe-inline';")
  })

  it('fails visibly when the expected strict policy is missing', () => {
    expect(() =>
      allowViteDevelopmentStyles(
        `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self';">`
      )
    ).toThrow('Unable to locate the strict style-src directive in index.html')
  })
})
