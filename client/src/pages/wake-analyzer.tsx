import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Play, AlertCircle, CheckCircle, BarChart3, Database } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";

interface Dataset {
  id: string;
  sessionId: string;
  filename: string;
  rowCount: number;
  columnCount: number;
  columns: string[];
  columnTypes: Record<string, string>;
  uploadedAt: string;
}

interface ExecutionResult {
  success: boolean;
  operation: string;
  result: any;
  chart?: string;
  filtered_row_count: number;
  error?: string;
}

export default function WakeAnalyzerPage() {
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [currentSession, setCurrentSession] = useState<string | null>(null);
  const [queryText, setQueryText] = useState("");
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);

  // Fetch datasets
  const { data: datasets, refetch: refetchDatasets } = useQuery<Dataset[]>({
    queryKey: ["/api/wake-analyzer/datasets"],
  });

  // Fetch current dataset metadata
  const { data: currentDataset } = useQuery<Dataset>({
    queryKey: ["/api/wake-analyzer/datasets", currentSession],
    enabled: !!currentSession,
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/wake-analyzer/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }

      return response.json();
    },
    onSuccess: (data) => {
      setCurrentSession(data.sessionId);
      refetchDatasets();
      toast({
        title: "Upload successful",
        description: `Dataset loaded: ${data.metadata.row_count} rows, ${data.metadata.columns.length} columns`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Execute mutation
  const executeMutation = useMutation({
    mutationFn: async (plan: any) => {
      const response = await fetch("/api/wake-analyzer/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: currentSession,
          plan,
        }),
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Execution failed");
      }

      return response.json();
    },
    onSuccess: (data) => {
      setExecutionResult(data);
    },
    onError: (error: Error) => {
      toast({
        title: "Execution failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith(".csv")) {
        toast({
          title: "Invalid file",
          description: "Only CSV files are allowed",
          variant: "destructive",
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = () => {
    if (selectedFile) {
      uploadMutation.mutate(selectedFile);
    }
  };

  const handleExecuteQuery = () => {
    // For demonstration, this would parse the query text into a plan
    // In production, you'd use Claude or another LLM to generate the plan
    try {
      const plan = JSON.parse(queryText);
      executeMutation.mutate(plan);
    } catch (error) {
      toast({
        title: "Invalid plan",
        description: "Please provide valid JSON execution plan",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Wake Analyzer</h1>
          <p className="text-muted-foreground">Conversational Data Analysis Platform</p>
        </div>
        <Badge variant="outline" className="flex items-center gap-2">
          <Database className="h-4 w-4" />
          {datasets?.length || 0} datasets
        </Badge>
      </div>

      <Tabs defaultValue="upload" className="w-full">
        <TabsList>
          <TabsTrigger value="upload">Upload Data</TabsTrigger>
          <TabsTrigger value="analyze" disabled={!currentSession}>Analyze</TabsTrigger>
          <TabsTrigger value="history" disabled={!currentSession}>History</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Upload CSV Dataset</CardTitle>
              <CardDescription>
                Upload a CSV file to begin analysis. All computations are performed by Python (pandas/numpy).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Input
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="flex-1"
                />
                <Button
                  onClick={handleUpload}
                  disabled={!selectedFile || uploadMutation.isPending}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {uploadMutation.isPending ? "Uploading..." : "Upload"}
                </Button>
              </div>

              {currentDataset && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-semibold">{currentDataset.filename}</div>
                    <div className="text-sm text-muted-foreground">
                      {currentDataset.rowCount} rows × {currentDataset.columnCount} columns
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {currentDataset.columns.map((col) => (
                        <Badge key={col} variant="secondary" className="text-xs">
                          {col}: {currentDataset.columnTypes[col]}
                        </Badge>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {datasets && datasets.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold mb-2">Recent Datasets</h3>
                  <div className="space-y-2">
                    {datasets.map((dataset) => (
                      <Card
                        key={dataset.id}
                        className={`cursor-pointer transition-colors ${
                          currentSession === dataset.sessionId ? "border-primary" : ""
                        }`}
                        onClick={() => setCurrentSession(dataset.sessionId)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium">{dataset.filename}</div>
                              <div className="text-sm text-muted-foreground">
                                {dataset.rowCount} rows × {dataset.columnCount} columns
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(dataset.uploadedAt).toLocaleDateString()}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analyze" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Execute Analytics Plan</CardTitle>
              <CardDescription>
                Provide a JSON execution plan. All results come from Python execution (no AI hallucination).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder={`{
  "operation": "mean",
  "target_column": "age",
  "filters": [
    {"column": "status", "operator": "==", "value": "active"}
  ],
  "chart_type": "histogram"
}`}
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                rows={12}
                className="font-mono text-sm"
              />

              <Button
                onClick={handleExecuteQuery}
                disabled={!queryText || executeMutation.isPending}
                className="w-full"
              >
                <Play className="mr-2 h-4 w-4" />
                {executeMutation.isPending ? "Executing..." : "Execute Plan"}
              </Button>

              {executionResult && (
                <div className="mt-6 space-y-4">
                  {executionResult.success ? (
                    <>
                      <Alert>
                        <CheckCircle className="h-4 w-4" />
                        <AlertDescription>
                          <div className="font-semibold">Execution Successful</div>
                          <div className="text-sm">
                            Operation: {executionResult.operation} | Rows analyzed:{" "}
                            {executionResult.filtered_row_count}
                          </div>
                        </AlertDescription>
                      </Alert>

                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <BarChart3 className="h-5 w-5" />
                            Result
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <pre className="bg-muted p-4 rounded-lg overflow-auto">
                            {JSON.stringify(executionResult.result, null, 2)}
                          </pre>
                        </CardContent>
                      </Card>

                      {executionResult.chart && (
                        <Card>
                          <CardHeader>
                            <CardTitle>Visualization</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <img
                              src={executionResult.chart}
                              alt="Analysis chart"
                              className="w-full rounded-lg"
                            />
                          </CardContent>
                        </Card>
                      )}
                    </>
                  ) : (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <div className="font-semibold">Execution Failed</div>
                        <div className="text-sm">{executionResult.error}</div>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Analysis History</CardTitle>
              <CardDescription>Previous executions for this dataset</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">History feature coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
