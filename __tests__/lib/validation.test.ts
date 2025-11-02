import { z } from 'zod'

/**
 * Test suite for validation schemas used throughout the application
 * These tests ensure that data validation is working correctly
 */

// Sample schemas for testing (these would mirror those used in actual application)
const userSchema = z.object({
  email: z.string().email('Invalid email format'),
  username: z.string().min(3, 'Username must be at least 3 characters').max(20, 'Username must be at most 20 characters'),
  displayName: z.string().min(1, 'Display name is required').max(100, 'Display name must be at most 100 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

const taskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title must be at most 255 characters'),
  description: z.string().optional(),
  completed: z.boolean().default(false),
  dueDate: z.date().optional(),
})

const emailSchema = z.string().email('Invalid email format')

describe('Validation Schemas', () => {
  describe('userSchema', () => {
    it('should validate a correct user object', () => {
      const validUser = {
        email: 'user@example.com',
        username: 'john_doe',
        displayName: 'John Doe',
        password: 'SecurePass123!',
      }

      const result = userSchema.safeParse(validUser)
      expect(result.success).toBe(true)
    })

    it('should reject invalid email', () => {
      const invalidUser = {
        email: 'not-an-email',
        username: 'john_doe',
        displayName: 'John Doe',
        password: 'SecurePass123!',
      }

      const result = userSchema.safeParse(invalidUser)
      expect(result.success).toBe(false)
    })

    it('should reject username that is too short', () => {
      const invalidUser = {
        email: 'user@example.com',
        username: 'jo',
        displayName: 'John Doe',
        password: 'SecurePass123!',
      }

      const result = userSchema.safeParse(invalidUser)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('at least 3 characters')
      }
    })

    it('should reject username that is too long', () => {
      const invalidUser = {
        email: 'user@example.com',
        username: 'a'.repeat(21),
        displayName: 'John Doe',
        password: 'SecurePass123!',
      }

      const result = userSchema.safeParse(invalidUser)
      expect(result.success).toBe(false)
    })

    it('should reject password that is too short', () => {
      const invalidUser = {
        email: 'user@example.com',
        username: 'john_doe',
        displayName: 'John Doe',
        password: 'Short1!',
      }

      const result = userSchema.safeParse(invalidUser)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('at least 8 characters')
      }
    })

    it('should reject when required fields are missing', () => {
      const invalidUser = {
        email: 'user@example.com',
        username: 'john_doe',
      }

      const result = userSchema.safeParse(invalidUser)
      expect(result.success).toBe(false)
    })

    it('should handle edge case usernames', () => {
      const validUser = {
        email: 'user@example.com',
        username: 'abc',
        displayName: 'John Doe',
        password: 'SecurePass123!',
      }

      const result = userSchema.safeParse(validUser)
      expect(result.success).toBe(true)
    })
  })

  describe('taskSchema', () => {
    it('should validate a minimal valid task', () => {
      const validTask = {
        title: 'Buy groceries',
      }

      const result = taskSchema.safeParse(validTask)
      expect(result.success).toBe(true)
    })

    it('should validate a complete task object', () => {
      const validTask = {
        title: 'Complete project',
        description: 'Finish all remaining tasks',
        completed: true,
        dueDate: new Date('2024-12-31'),
      }

      const result = taskSchema.safeParse(validTask)
      expect(result.success).toBe(true)
    })

    it('should set completed to false by default', () => {
      const task = {
        title: 'New task',
      }

      const result = taskSchema.safeParse(task)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.completed).toBe(false)
      }
    })

    it('should reject task without title', () => {
      const invalidTask = {
        description: 'No title provided',
      }

      const result = taskSchema.safeParse(invalidTask)
      expect(result.success).toBe(false)
    })

    it('should reject task with empty title', () => {
      const invalidTask = {
        title: '',
      }

      const result = taskSchema.safeParse(invalidTask)
      expect(result.success).toBe(false)
    })

    it('should reject task with title that is too long', () => {
      const invalidTask = {
        title: 'a'.repeat(256),
      }

      const result = taskSchema.safeParse(invalidTask)
      expect(result.success).toBe(false)
    })

    it('should allow optional description', () => {
      const taskWithoutDescription = {
        title: 'Task without description',
      }

      const result = taskSchema.safeParse(taskWithoutDescription)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.description).toBeUndefined()
      }
    })

    it('should handle invalid date', () => {
      const invalidTask = {
        title: 'Task with invalid date',
        dueDate: 'not-a-date',
      }

      const result = taskSchema.safeParse(invalidTask)
      expect(result.success).toBe(false)
    })
  })

  describe('emailSchema', () => {
    it('should validate correct email addresses', () => {
      const validEmails = [
        'user@example.com',
        'john.doe@company.co.uk',
        'test+tag@domain.org',
        'simple@test.io',
      ]

      validEmails.forEach((email) => {
        const result = emailSchema.safeParse(email)
        expect(result.success).toBe(true)
      })
    })

    it('should reject invalid email addresses', () => {
      const invalidEmails = [
        'not-an-email',
        '@example.com',
        'user@',
        'user@.com',
        'user name@example.com',
      ]

      invalidEmails.forEach((email) => {
        const result = emailSchema.safeParse(email)
        expect(result.success).toBe(false)
      })
    })

    it('should reject empty string', () => {
      const result = emailSchema.safeParse('')
      expect(result.success).toBe(false)
    })
  })

  describe('Error Handling', () => {
    it('should provide detailed error information', () => {
      const invalidUser = {
        email: 'invalid-email',
        username: 'ab',
        displayName: '',
        password: 'short',
      }

      const result = userSchema.safeParse(invalidUser)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0)
        expect(result.error.issues[0].path).toBeDefined()
        expect(result.error.issues[0].message).toBeDefined()
      }
    })

    it('should throw when using parse instead of safeParse', () => {
      const invalidUser = {
        email: 'invalid',
      }

      expect(() => {
        userSchema.parse(invalidUser)
      }).toThrow()
    })
  })
})
