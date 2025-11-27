import { useState } from 'react'
import { Button, Card } from '@heroui/react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-8 text-gray-800">
          MBO DB
        </h1>
        
        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Welcome to MBO DB</h2>
          <p className="mb-4 text-gray-600">
            Built with Vite + React 19 + TypeScript + HeroUI v3 + Tailwind CSS v4
          </p>
          <div className="flex gap-4 items-center">
            <Button 
              variant="primary" 
              onPress={() => setCount((count) => count + 1)}
            >
              Count is {count}
            </Button>
            <Button 
              variant="secondary" 
              onPress={() => setCount(0)}
            >
              Reset
            </Button>
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4">
            <h3 className="text-lg font-semibold mb-2">⚡ Vite</h3>
            <p className="text-sm text-gray-600">
              Lightning fast build tool and dev server
            </p>
          </Card>
          
          <Card className="p-4">
            <h3 className="text-lg font-semibold mb-2">⚛️ React 19</h3>
            <p className="text-sm text-gray-600">
              Modern React with hooks and TypeScript
            </p>
          </Card>
          
          <Card className="p-4">
            <h3 className="text-lg font-semibold mb-2">🎨 HeroUI v3</h3>
            <p className="text-sm text-gray-600">
              Beautiful and accessible UI components
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default App
