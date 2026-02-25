import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { apiGet, apiPost, apiPatch } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ArrowLeft, BookOpen, CheckCircle2, Circle, Play, Users } from 'lucide-react'

interface Module {
  id: string
  title: string
  position: number
  status: string
  children: Lesson[]
}

interface Lesson {
  id: string
  title: string
  position: number
  status: string
}

export function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>()
  const navigate = useNavigate()
  const { currentAccountId } = useAuth()

  const [course, setCourse] = useState<any>(null)
  const [modules, setModules] = useState<Module[]>([])
  const [loading, setLoading] = useState(true)
  const [enrolled, setEnrolled] = useState(false)
  const [enrollmentId, setEnrollmentId] = useState<string | null>(null)
  const [completedLessonIds, setCompletedLessonIds] = useState<Set<string>>(new Set())
  const [enrolling, setEnrolling] = useState(false)

  useEffect(() => {
    if (!currentAccountId || !courseId) return

    async function load() {
      const currentCourseId = courseId!
      setLoading(true)
      try {
        // Fetch course article
        const courseData = await apiGet<any>('kb-articles', { id: currentCourseId })
        setCourse(courseData)

        // Fetch children (modules)
        const children = await apiGet<any[]>('kb-articles', { parent_id: currentCourseId })

        // For each module, fetch its lessons
        const modulesWithLessons: Module[] = await Promise.all(
          children.map(async (mod: any) => {
            const lessons = await apiGet<any[]>('kb-articles', { parent_id: mod.id })
            return {
              ...mod,
              children: lessons.sort((a: any, b: any) => a.position - b.position),
            }
          }),
        )
        setModules(modulesWithLessons.sort((a, b) => a.position - b.position))

        // Check enrollment
        const enrollCheck = await apiGet<any>('enrollments', { course_id: currentCourseId, check: 'me' })
        setEnrolled(enrollCheck.enrolled)
        setEnrollmentId(enrollCheck.enrollment_id)

        // If enrolled, fetch completions
        if (enrollCheck.enrollment_id) {
          const completions = await apiGet<any[]>('lesson-completions', {
            enrollment_id: enrollCheck.enrollment_id,
          })
          setCompletedLessonIds(new Set(completions.map((c: any) => c.article_id)))
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [currentAccountId, courseId])

  async function handleEnroll() {
    if (!courseId) return
    const currentCourseId = courseId as string
    setEnrolling(true)
    try {
      const result = await apiPost<any>('enrollments', { course_id: currentCourseId })
      setEnrolled(true)
      setEnrollmentId(result.id)
    } catch {
      // Silently fail
    } finally {
      setEnrolling(false)
    }
  }

  // Count total lessons and completed
  const totalLessons = modules.reduce((sum, m) => sum + m.children.length, 0)
  const completedCount = completedLessonIds.size
  const progressPercent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-1 h-4 w-4" />Back
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Course</h1>
        </div>
        <Card><CardContent className="py-6 text-sm text-muted-foreground">Loading...</CardContent></Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-1 h-4 w-4" />Back
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">{course?.title || 'Course'}</h1>
        </div>
        {!enrolled ? (
          <Button onClick={handleEnroll} disabled={enrolling}>
            <Play className="mr-1 h-4 w-4" />
            {enrolling ? 'Enrolling...' : 'Enroll'}
          </Button>
        ) : (
          <Badge variant="default" className="text-sm px-3 py-1">Enrolled</Badge>
        )}
      </div>

      {/* Course description */}
      {course?.body && (
        <Card>
          <CardContent className="py-4">
            <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: course.body }} />
          </CardContent>
        </Card>
      )}

      {/* Progress bar */}
      {enrolled && totalLessons > 0 && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Progress</p>
              <p className="text-sm text-muted-foreground">
                {completedCount} / {totalLessons} lessons ({progressPercent}%)
              </p>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* Course info */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold">{modules.length}</p>
            <p className="text-sm text-muted-foreground">Modules</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold">{totalLessons}</p>
            <p className="text-sm text-muted-foreground">Lessons</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold">{course?.author?.full_name || '—'}</p>
            <p className="text-sm text-muted-foreground">Instructor</p>
          </CardContent>
        </Card>
      </div>

      {/* Modules and lessons tree */}
      {modules.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            No modules yet. Add child KB articles to this course to create modules.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {modules.map((mod, mi) => (
            <Card key={mod.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BookOpen className="h-4 w-4" />
                  Module {mi + 1}: {mod.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {mod.children.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No lessons in this module</p>
                ) : (
                  <div className="space-y-1">
                    {mod.children.map((lesson, li) => {
                      const isCompleted = completedLessonIds.has(lesson.id)
                      return (
                        <div
                          key={lesson.id}
                          className="flex items-center justify-between rounded-md px-3 py-2 text-sm cursor-pointer hover:bg-accent transition-colors"
                          onClick={() => {
                            if (enrolled && enrollmentId) {
                              navigate(`/courses/${courseId}/lessons/${lesson.id}`)
                            }
                          }}
                        >
                          <div className="flex items-center gap-3">
                            {isCompleted ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <Circle className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span className={isCompleted ? 'text-muted-foreground line-through' : ''}>
                              {li + 1}. {lesson.title}
                            </span>
                          </div>
                          {!enrolled && (
                            <Badge variant="outline" className="text-[10px]">Enroll to access</Badge>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
