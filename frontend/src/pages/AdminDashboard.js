import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, Calendar, UserCog, Activity } from 'lucide-react';

const AdminDashboard = () => {
  const { API, getAuthHeader } = useAuth();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, usersRes, appointmentsRes] = await Promise.all([
        axios.get(`${API}/admin/stats`, getAuthHeader()),
        axios.get(`${API}/admin/users`, getAuthHeader()),
        axios.get(`${API}/admin/all-appointments`, getAuthHeader())
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data);
      setAppointments(appointmentsRes.data);
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const variants = {
      pending: { variant: 'secondary', label: 'Chờ xác nhận' },
      confirmed: { variant: 'default', label: 'Đã xác nhận' },
      completed: { variant: 'success', label: 'Hoàn thành' },
      cancelled: { variant: 'destructive', label: 'Đã hủy' }
    };
    const { variant, label } = variants[status] || variants.pending;
    return <Badge variant={variant}>{label}</Badge>;
  };

  const getRoleBadge = (role) => {
    const variants = {
      patient: { variant: 'outline', label: 'Bệnh nhân' },
      doctor: { variant: 'default', label: 'Bác sĩ' },
      admin: { variant: 'destructive', label: 'Admin' }
    };
    const { variant, label } = variants[role] || variants.patient;
    return <Badge variant={variant}>{label}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Đang tải...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6" data-testid="admin-dashboard">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Quản Trị Hệ Thống</h1>
        <p className="text-gray-600">Tổng quan và quản lý toàn bộ dữ liệu</p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tổng Người Dùng</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_users}</div>
              <p className="text-xs text-muted-foreground">
                {stats.total_patients} bệnh nhân, {stats.total_doctors} bác sĩ
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Lịch Hẹn</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_appointments}</div>
              <p className="text-xs text-muted-foreground">
                {stats.pending_appointments} chờ xác nhận
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Đã Xác Nhận</CardTitle>
              <UserCog className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.confirmed_appointments}</div>
              <p className="text-xs text-muted-foreground">Lịch hẹn đang hoạt động</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Hoàn Thành</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completed_appointments}</div>
              <p className="text-xs text-muted-foreground">
                {stats.cancelled_appointments} đã hủy
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Data Tables */}
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">Người Dùng ({users.length})</TabsTrigger>
          <TabsTrigger value="appointments">Lịch Hẹn ({appointments.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Danh Sách Người Dùng</CardTitle>
              <CardDescription>Tất cả người dùng trong hệ thống</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mã Số</TableHead>
                    <TableHead>Họ Tên</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Điện Thoại</TableHead>
                    <TableHead>Vai Trò</TableHead>
                    <TableHead>Ngày Tạo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-mono text-sm">
                        {user.patient_code || user.doctor_code || 'N/A'}
                      </TableCell>
                      <TableCell className="font-medium">{user.full_name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.phone}</TableCell>
                      <TableCell>{getRoleBadge(user.role)}</TableCell>
                      <TableCell>{new Date(user.created_at).toLocaleDateString('vi-VN')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appointments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Danh Sách Lịch Hẹn</CardTitle>
              <CardDescription>Tất cả lịch hẹn trong hệ thống</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ngày/Giờ</TableHead>
                    <TableHead>Bệnh Nhân</TableHead>
                    <TableHead>Bác Sĩ</TableHead>
                    <TableHead>Chuyên Khoa</TableHead>
                    <TableHead>Trạng Thái</TableHead>
                    <TableHead>Lý Do</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {appointments.map((apt) => (
                    <TableRow key={apt.id}>
                      <TableCell>
                        <div className="font-medium">{apt.appointment_date}</div>
                        <div className="text-sm text-gray-500">{apt.appointment_time}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{apt.patient_name}</div>
                        <div className="text-sm text-gray-500">{apt.patient_code}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{apt.doctor_name}</div>
                        <div className="text-sm text-gray-500">{apt.doctor_code}</div>
                      </TableCell>
                      <TableCell>{apt.doctor_specialty}</TableCell>
                      <TableCell>{getStatusBadge(apt.status)}</TableCell>
                      <TableCell className="max-w-xs truncate">{apt.reason}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminDashboard;