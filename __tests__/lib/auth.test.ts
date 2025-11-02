import { hashPassword, comparePassword } from '@/lib/auth'

describe('Auth Library', () => {
  describe('hashPassword', () => {
    it('should hash a password successfully', async () => {
      const password = 'MySecurePassword123!'
      const hash = await hashPassword(password)

      expect(hash).toBeDefined()
      expect(typeof hash).toBe('string')
      expect(hash.length).toBeGreaterThan(0)
      expect(hash).not.toBe(password)
    })

    it('should generate different hashes for the same password', async () => {
      const password = 'MySecurePassword123!'
      const hash1 = await hashPassword(password)
      const hash2 = await hashPassword(password)

      expect(hash1).not.toBe(hash2)
    })

    it('should handle long passwords', async () => {
      const longPassword = 'A'.repeat(100)
      const hash = await hashPassword(longPassword)

      expect(hash).toBeDefined()
      expect(typeof hash).toBe('string')
    })

    it('should handle passwords with special characters', async () => {
      const password = 'P@$$w0rd!#%&*()_+-=[]{}|;:,.<>?'
      const hash = await hashPassword(password)

      expect(hash).toBeDefined()
      expect(typeof hash).toBe('string')
    })
  })

  describe('comparePassword', () => {
    let password: string
    let hash: string

    beforeEach(async () => {
      password = 'MySecurePassword123!'
      hash = await hashPassword(password)
    })

    it('should return true when comparing correct password with hash', async () => {
      const result = await comparePassword(password, hash)
      expect(result).toBe(true)
    })

    it('should return false when comparing incorrect password with hash', async () => {
      const wrongPassword = 'WrongPassword123!'
      const result = await comparePassword(wrongPassword, hash)
      expect(result).toBe(false)
    })

    it('should be case-sensitive', async () => {
      const wrongCase = 'mysecurepassword123!'
      const result = await comparePassword(wrongCase, hash)
      expect(result).toBe(false)
    })

    it('should return false for empty password', async () => {
      const result = await comparePassword('', hash)
      expect(result).toBe(false)
    })

    it('should handle passwords with special characters', async () => {
      const specialPassword = 'P@$$w0rd!#%&*()_+-=[]{}|;:,.<>?'
      const specialHash = await hashPassword(specialPassword)
      const result = await comparePassword(specialPassword, specialHash)
      expect(result).toBe(true)
    })

    it('should return false when hash is tampered', async () => {
      const tamperedHash = hash.substring(0, hash.length - 1) + 'X'
      const result = await comparePassword(password, tamperedHash)
      expect(result).toBe(false)
    })
  })

  describe('Password Hash Cycle', () => {
    it('should successfully hash and compare a password in a single cycle', async () => {
      const testPassword = 'TestPassword2024!'
      const hashedPassword = await hashPassword(testPassword)
      const isMatch = await comparePassword(testPassword, hashedPassword)

      expect(isMatch).toBe(true)
    })

    it('should fail password cycle with wrong password', async () => {
      const testPassword = 'TestPassword2024!'
      const wrongPassword = 'WrongPassword2024!'
      const hashedPassword = await hashPassword(testPassword)
      const isMatch = await comparePassword(wrongPassword, hashedPassword)

      expect(isMatch).toBe(false)
    })
  })
})
