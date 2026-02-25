import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BookOpen, Users } from 'lucide-react'

export function CoursesPage() {
  const navigate = useNavigate()
  const { currentAccountId } = useAuth()
  const [courses, setCourses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentAccountId) return
    setLoading(true)
    // Courses are top-level KB articles (no parent) with category containing 'course'
    apiGet<any[]>('kb-articles', { parent_id: 'null' })
      .then((articles) => {
        // Filter to course-type articles (category = 'course' or metadata.is_course)
        const courseArticles = articles.filter(
          (a: any) => a.category === 'course' || a.metadata?.is_course,
        )
        setCourses(courseArticles)
      })
      .catch(() => setCourses([]))
      .finally(() => setLoading(false))
  }, [currentAccountId])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Courses</h1>
          <p className="mt-1 text-muted-foreground">Browse and enroll in courses</p>
        </div>
        <Button onClick={() => navigate('/documents/new')} size="sm" variant="outline">
          Create Course
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <p className="text-sm text-muted-foreground col-span-full">Loading courses...</p>
        ) : courses.length === 0 ? (
          <p className="text-sm text-muted-foreground col-span-full">
            No courses yet. Create a document with category "course" to get started.
          </p>
        ) : (
          courses.map((course: any) => (
            <Card
              key={course.id}
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => navigate(`/courses/${course.id}`)}
            >
              <CardContent className="py-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
                    <BookOpen className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{course.title}</p>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {course.author?.full_name || 'Unknown instructor'}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant={course.status === 'published' ? 'default' : 'secondary'}>
                        {course.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
