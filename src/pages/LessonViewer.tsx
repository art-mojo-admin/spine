import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { apiGet, apiPost, apiDelete } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { ThreadPanel } from '@/components/shared/ThreadPanel'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, BookOpen } from 'lucide-react'

export function LessonViewerPage() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>()
  const navigate = useNavigate()
  const { currentAccountId } = useAuth()

  const [lesson, setLesson] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [enrollmentId, setEnrollmentId] = useState<string | null>(null)
  const [isCompleted, setIsCompleted] = useState(false)
  const [completionId, setCompletionId] = useState<string | null>(null)
  const [toggling, setToggling] = useState(false)
  const [siblings, setSiblings] = useState<any[]>([])

  useEffect(() => {
    if (!currentAccountId || !courseId || !lessonId) return

    async function load() {
      const currentCourseId = courseId!
      const currentLessonId = lessonId!
      setLoading(true)
      try {
        // Fetch lesson content
        const lessonData = await apiGet<any>('kb-articles', { id: currentLessonId })
        setLesson(lessonData)

        // Get enrollment
        const enrollCheck = await apiGet<any>('enrollments', { course_id: currentCourseId, check: 'me' })
        setEnrollmentId(enrollCheck.enrollment_id)

        // Get completions to check if this lesson is done
        if (enrollCheck.enrollment_id) {
          const completions = await apiGet<any[]>('lesson-completions', {
            enrollment_id: enrollCheck.enrollment_id,
          })
          const match = completions.find((c: any) => c.article_id === currentLessonId)
          setIsCompleted(!!match)
          setCompletionId(match?.id || null)
        }

        // Get sibling lessons for navigation
        if (lessonData.parent_article_id) {
          const sibs = await apiGet<any[]>('kb-articles', { parent_id: lessonData.parent_article_id })
          setSiblings(sibs.sort((a: any, b: any) => a.position - b.position))
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [currentAccountId, courseId, lessonId])

  async function toggleComplete() {
    if (!enrollmentId || !lessonId) return
    setToggling(true)
    try {
      if (isCompleted && completionId) {
        await apiDelete('lesson-completions', { id: completionId })
        setIsCompleted(false)
        setCompletionId(null)
      } else {
        const result = await apiPost<any>('lesson-completions', {
          enrollment_id: enrollmentId,
          article_id: lessonId,
        })
        setIsCompleted(true)
        setCompletionId(result.id)
      }
    } catch {
      // Silently fail
    } finally {
      setToggling(false)
    }
  }

  // Find prev/next sibling
  const currentIndex = siblings.findIndex((s: any) => s.id === lessonId)
  const prevLesson = currentIndex > 0 ? siblings[currentIndex - 1] : null
  const nextLesson = currentIndex < siblings.length - 1 ? siblings[currentIndex + 1] : null

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/courses/${courseId}`)}>
            <ArrowLeft className="mr-1 h-4 w-4" />Back to Course
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Lesson</h1>
        </div>
        <Card><CardContent className="py-6 text-sm text-muted-foreground">Loading...</CardContent></Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/courses/${courseId}`)}>
            <ArrowLeft className="mr-1 h-4 w-4" />Back to Course
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">{lesson?.title || 'Lesson'}</h1>
        </div>
        {enrollmentId && (
          <Button
            variant={isCompleted ? 'secondary' : 'default'}
            size="sm"
            disabled={toggling}
            onClick={toggleComplete}
          >
            {isCompleted ? (
              <>
                <CheckCircle2 className="mr-1 h-4 w-4 text-green-500" />
                Completed
              </>
            ) : (
              <>
                <Circle className="mr-1 h-4 w-4" />
                Mark Complete
              </>
            )}
          </Button>
        )}
      </div>

      {/* Lesson content */}
      <Card>
        <CardContent className="py-6">
          {lesson?.body ? (
            <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: lesson.body }} />
          ) : (
            <p className="text-sm text-muted-foreground">No content yet</p>
          )}
        </CardContent>
      </Card>

      {/* Prev/Next navigation */}
      {siblings.length > 1 && (
        <div className="flex items-center justify-between">
          {prevLesson ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/courses/${courseId}/lessons/${prevLesson.id}`)}
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              {prevLesson.title}
            </Button>
          ) : (
            <div />
          )}
          {nextLesson ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/courses/${courseId}/lessons/${nextLesson.id}`)}
            >
              {nextLesson.title}
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <div />
          )}
        </div>
      )}

      {/* Discussion */}
      {lessonId && (
        <ThreadPanel targetType="document" targetId={lessonId} />
      )}
    </div>
  )
}
