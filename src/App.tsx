import { useState } from 'react'
import { Button, Card, CardHeader, CardBody } from '@heroui/react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-8 text-gray-800 dark:text-white">
          MBO DB
        </h1>
        
        <Card className="mb-6">
          <CardHeader className="flex gap-3">
            <div className="flex flex-col">
              <p className="text-xl font-semibold">Welcome to MBO DB</p>
              <p className="text-small text-default-500">Built with Vite + React 18 + TypeScript + HeroUI v2 + Tailwind CSS v3</p>
            </div>
          </CardHeader>
          <CardBody>
            <p className="mb-4">
              This is your starter template with Firebase integration ready to go!
            </p>
            <div className="flex gap-4 items-center">
              <Button 
                color="primary" 
                onClick={() => setCount((count) => count + 1)}
              >
                Count is {count}
              </Button>
              <Button 
                color="secondary" 
                variant="bordered"
                onClick={() => setCount(0)}
              >
                Reset
              </Button>
            </div>
          </CardBody>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardBody>
              <h3 className="text-lg font-semibold mb-2">⚡ Vite</h3>
              <p className="text-small text-default-500">
                Lightning fast build tool and dev server
              </p>
            </CardBody>
          </Card>
          
          <Card>
            <CardBody>
              <h3 className="text-lg font-semibold mb-2">⚛️ React 18</h3>
              <p className="text-small text-default-500">
                Modern React with hooks and TypeScript
              </p>
            </CardBody>
          </Card>
          
          <Card>
            <CardBody>
              <h3 className="text-lg font-semibold mb-2">🎨 HeroUI v2</h3>
              <p className="text-small text-default-500">
                Beautiful and accessible UI components
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default App
