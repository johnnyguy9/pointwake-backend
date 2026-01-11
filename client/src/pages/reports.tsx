import { useQuery } from "@tanstack/react-query";
import { BarChart3, Download, Phone, Bot, Clock, Truck, DollarSign, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import type { UsageRecord } from "@shared/schema";
import type { BillingEstimate } from "@/lib/types";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

export default function ReportsPage() {
  const [period, setPeriod] = useState("this_month");

  const { data: usageRecords = [], isLoading: usageLoading } = useQuery<UsageRecord[]>({
    queryKey: ["/api/usage"],
  });

  const { data: billingEstimate, isLoading: billingLoading } = useQuery<BillingEstimate>({
    queryKey: ["/api/billing/estimate"],
  });

  const callVolumeData = [
    { name: "Mon", calls: 45, ai: 38, human: 7 },
    { name: "Tue", calls: 52, ai: 44, human: 8 },
    { name: "Wed", calls: 38, ai: 32, human: 6 },
    { name: "Thu", calls: 65, ai: 55, human: 10 },
    { name: "Fri", calls: 48, ai: 40, human: 8 },
    { name: "Sat", calls: 25, ai: 22, human: 3 },
    { name: "Sun", calls: 18, ai: 16, human: 2 },
  ];

  const outcomeData = [
    { name: "AI Resolved", value: 65, color: "hsl(var(--chart-1))" },
    { name: "Dispatched", value: 20, color: "hsl(var(--chart-3))" },
    { name: "Transferred", value: 10, color: "hsl(var(--chart-4))" },
    { name: "Voicemail", value: 5, color: "hsl(var(--chart-5))" },
  ];

  const totalCalls = usageRecords.reduce((sum, r) => sum + (r.totalCalls || 0), 0);
  const totalAiMinutes = usageRecords.reduce((sum, r) => sum + (r.aiMinutes || 0), 0);
  const totalMinutes = usageRecords.reduce((sum, r) => sum + (r.totalMinutes || 0), 0);
  const totalDispatches = usageRecords.reduce((sum, r) => sum + (r.dispatchActions || 0), 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Reports</h1>
          <p className="text-muted-foreground mt-1">Analytics and billing overview</p>
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[160px]" data-testid="select-period">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="this_week">This Week</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="last_month">Last Month</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="gap-2" data-testid="button-export-report">
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Calls</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {usageLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-semibold" data-testid="stat-total-calls">{totalCalls}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-status-online">+12%</span> from last period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">AI Minutes</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {usageLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-semibold" data-testid="stat-ai-minutes">{Math.round(totalAiMinutes)}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {totalMinutes > 0 ? `${Math.round((totalAiMinutes / totalMinutes) * 100)}%` : "0%"} of total time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Dispatches</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {usageLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-semibold" data-testid="stat-dispatches">{totalDispatches}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">service calls dispatched</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Estimated Bill</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {billingLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-semibold" data-testid="stat-estimated-bill">
                ${billingEstimate?.totalEstimate?.toFixed(2) || "0.00"}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">current billing period</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Call Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={callVolumeData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "0.375rem",
                    }}
                  />
                  <Bar dataKey="ai" name="AI Handled" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="human" name="Human Handled" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Call Outcomes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] flex items-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={outcomeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {outcomeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "0.375rem",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Billing Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {billingLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex justify-between items-center py-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          ) : billingEstimate ? (
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground">Base Fee ({billingEstimate.locationCount} locations)</span>
                <span className="font-medium">${billingEstimate.baseCharges?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground">AI Usage ({Math.round(billingEstimate.aiMinutes)} minutes)</span>
                <span className="font-medium">${billingEstimate.aiCharges?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center py-3 font-semibold">
                <span>Total Estimate</span>
                <span className="text-lg">${billingEstimate.totalEstimate?.toFixed(2)}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No billing data available</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
