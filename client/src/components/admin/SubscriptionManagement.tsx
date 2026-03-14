import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function SubscriptionManagement() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Subscription Management</CardTitle>
        <CardDescription>Manage tenant subscriptions and billing</CardDescription>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold mb-3">Subscription Plans</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plan Name</TableHead>
                  <TableHead>Monthly Price</TableHead>
                  <TableHead>Max Links</TableHead>
                  <TableHead>API Calls/Day</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Free</TableCell>
                  <TableCell>$0</TableCell>
                  <TableCell>100</TableCell>
                  <TableCell>1,000</TableCell>
                  <TableCell>
                    <Badge>Active</Badge>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Pro</TableCell>
                  <TableCell>$29</TableCell>
                  <TableCell>10,000</TableCell>
                  <TableCell>100,000</TableCell>
                  <TableCell>
                    <Badge>Active</Badge>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Enterprise</TableCell>
                  <TableCell>Custom</TableCell>
                  <TableCell>Unlimited</TableCell>
                  <TableCell>Unlimited</TableCell>
                  <TableCell>
                    <Badge>Active</Badge>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <div>
            <h3 className="font-semibold mb-3">Active Subscriptions</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Billing Cycle</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expires</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">--</TableCell>
                  <TableCell>--</TableCell>
                  <TableCell>--</TableCell>
                  <TableCell>--</TableCell>
                  <TableCell>--</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
