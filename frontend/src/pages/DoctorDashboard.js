import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Calendar as CalendarIcon, Clock, User, Phone, Mail, Plus, Check, X, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';

const DoctorDashboard = () => {
  const { API, getAuthHeader, user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [hasProfile, setHasProfile] = useState(false);

  useEffect(() => {
    fetchProfile();
    fetchSpecialties();
  }, []);

  useEffect(() => {
    if (hasProfile) {
      fetchAppointments();
    }
  }, [hasProfile]);

  const fetchProfile = async () => {
    try {
      const response = await axios.get(`${API}/doctors/${user.id}`);
      setProfile(response.data);
      setHasProfile(true);
    } catch (error) {
      if (error.response?.status === 404) {
        setHasProfile(false);
      }
    }
  };

  const fetchSpecialties = async () => {
    try {
      const response = await axios.get(`${API}/specialties`);
      setSpecialties(response.data.specialties);
    } catch (error) {
      console.error('Error fetching specialties:', error);
    }
  };

  const fetchAppointments = async () => {
    try {
      const response = await axios.get(`${API}/appointments/my-appointments`, getAuthHeader());
      setAppointments(response.data);
    } catch (error) {
      console.error('Error fetching appointments:', error);
    }
  };

  const updateAppointmentStatus = async (appointmentId, status, doctorNotes = null) => {
    try {
      const data = { status };
      if (doctorNotes) {
        data.doctor_notes = doctorNotes;
      }
      await axios.patch(`${API}/appointments/${appointmentId}`, data, getAuthHeader());
      toast.success('Cập nhật trạng thái thành công!');
      fetchAppointments();
    } catch (error) {
      toast.error('Không thể cập nhật trạng thái');
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
    return <Badge variant={variant} data-testid={`status-badge-${status}`}>{label}</Badge>;
  };

  if (!hasProfile) {
    return <CreateProfileForm onSuccess={() => { setHasProfile(true); fetchProfile(); }} />;
  }

  return (
    <div className="max-w-7xl mx-auto p-6" data-testid="doctor-dashboard">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Bảng Điều Khiển Bác Sĩ</h1>
        <p className="text-gray-600">Quản lý lịch làm việc và lịch hẹn của bạn</p>
      </div>

      <Tabs defaultValue="appointments" className="space-y-4">
        <TabsList>
          <TabsTrigger value="appointments" data-testid="appointments-tab">
            <CalendarIcon className="h-4 w-4 mr-2" />
            Lịch Hẹn
          </TabsTrigger>
          <TabsTrigger value="schedule" data-testid="schedule-tab">
            <Clock className="h-4 w-4 mr-2" />
            Quản Lý Lịch Làm Việc
          </TabsTrigger>
        </TabsList>

        <TabsContent value="appointments" className="space-y-4">
          {appointments.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <CalendarIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500">Chưa có lịch hẹn nào</p>
              </CardContent>
            </Card>
          ) : (
            appointments.map((appointment) => (
              <AppointmentCard
                key={appointment.id}
                appointment={appointment}
                onUpdate={updateAppointmentStatus}
                getStatusBadge={getStatusBadge}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="schedule" className="space-y-4">
          <ScheduleManager />
        </TabsContent>
      </Tabs>
    </div>
  );
};

const CreateProfileForm = ({ onSuccess }) => {
  const { API, getAuthHeader } = useAuth();
  const [specialties, setSpecialties] = useState([]);
  const [formData, setFormData] = useState({
    specialty: '',
    experience_years: '',
    description: '',
    consultation_fee: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSpecialties();
  }, []);

  const fetchSpecialties = async () => {
    try {
      const response = await axios.get(`${API}/specialties`);
      setSpecialties(response.data.specialties);
    } catch (error) {
      console.error('Error fetching specialties:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await axios.post(
        `${API}/doctors/profile`,
        {
          ...formData,
          experience_years: parseInt(formData.experience_years),
          consultation_fee: parseFloat(formData.consultation_fee)
        },
        getAuthHeader()
      );
      toast.success('Tạo hồ sơ thành công!');
      onSuccess();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Không thể tạo hồ sơ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Card data-testid="create-profile-card">
        <CardHeader>
          <CardTitle>Tạo Hồ Sơ Bác Sĩ</CardTitle>
          <CardDescription>Vui lòng điền thông tin để hoàn thiện hồ sơ của bạn</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="specialty">Chuyên khoa *</Label>
              <Select
                value={formData.specialty}
                onValueChange={(value) => setFormData({ ...formData, specialty: value })}
              >
                <SelectTrigger data-testid="specialty-select">
                  <SelectValue placeholder="Chọn chuyên khoa" />
                </SelectTrigger>
                <SelectContent>
                  {specialties.map((specialty) => (
                    <SelectItem key={specialty} value={specialty}>{specialty}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="experience_years">Số năm kinh nghiệm *</Label>
              <Input
                id="experience_years"
                data-testid="experience-input"
                type="number"
                min="0"
                value={formData.experience_years}
                onChange={(e) => setFormData({ ...formData, experience_years: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="consultation_fee">Phí khám (VNĐ) *</Label>
              <Input
                id="consultation_fee"
                data-testid="fee-input"
                type="number"
                min="0"
                step="1000"
                value={formData.consultation_fee}
                onChange={(e) => setFormData({ ...formData, consultation_fee: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Mô tả *</Label>
              <Textarea
                id="description"
                data-testid="description-input"
                placeholder="Giới thiệu về bản thân, kinh nghiệm làm việc..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading} data-testid="create-profile-button">
              {loading ? 'Đang tạo...' : 'Tạo hồ sơ'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

const AppointmentCard = ({ appointment, onUpdate, getStatusBadge }) => {
  const [showNotesDialog, setShowNotesDialog] = useState(false);
  const [doctorNotes, setDoctorNotes] = useState('');

  const handleComplete = () => {
    if (!doctorNotes.trim()) {
      toast.error('Vui lòng nhập ghi chú trước khi hoàn thành');
      return;
    }
    onUpdate(appointment.id, 'completed', doctorNotes);
    setShowNotesDialog(false);
    setDoctorNotes('');
  };

  return (
    <Card data-testid="appointment-card">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">{appointment.patient_name}</CardTitle>
            <CardDescription>
              {appointment.appointment_date} • {appointment.appointment_time}
            </CardDescription>
          </div>
          {getStatusBadge(appointment.status)}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center text-sm text-gray-600">
          <Phone className="h-4 w-4 mr-2" />
          <span>{appointment.patient_phone}</span>
        </div>
        <div className="flex items-center text-sm text-gray-600">
          <Mail className="h-4 w-4 mr-2" />
          <span>{appointment.patient_email}</span>
        </div>
        {appointment.reason && (
          <div className="pt-2 border-t">
            <p className="text-sm font-medium text-gray-700">Lý do khám:</p>
            <p className="text-sm text-gray-600">{appointment.reason}</p>
          </div>
        )}
        {appointment.notes && (
          <div className="pt-2">
            <p className="text-sm font-medium text-gray-700">Ghi chú của bệnh nhân:</p>
            <p className="text-sm text-gray-600">{appointment.notes}</p>
          </div>
        )}
        {appointment.doctor_notes && (
          <div className="pt-2">
            <p className="text-sm font-medium text-gray-700">Ghi chú của bác sĩ:</p>
            <p className="text-sm text-gray-600">{appointment.doctor_notes}</p>
          </div>
        )}
      </CardContent>
      {appointment.status === 'pending' && (
        <CardFooter className="flex gap-2">
          <Button
            size="sm"
            variant="default"
            onClick={() => onUpdate(appointment.id, 'confirmed')}
            data-testid="confirm-button"
          >
            <Check className="h-4 w-4 mr-1" />
            Xác nhận
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => onUpdate(appointment.id, 'cancelled')}
            data-testid="reject-button"
          >
            <X className="h-4 w-4 mr-1" />
            Từ chối
          </Button>
        </CardFooter>
      )}
      {appointment.status === 'confirmed' && (
        <CardFooter>
          <Dialog open={showNotesDialog} onOpenChange={setShowNotesDialog}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="complete-button">
                <Check className="h-4 w-4 mr-1" />
                Hoàn thành
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Hoàn thành khám bệnh</DialogTitle>
                <DialogDescription>
                  Nhập ghi chú về kết quả khám bệnh
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <Textarea
                  data-testid="doctor-notes-input"
                  placeholder="Kết quả khám, chẩn đoán, đơn thuốc..."
                  value={doctorNotes}
                  onChange={(e) => setDoctorNotes(e.target.value)}
                  rows={5}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowNotesDialog(false)}>
                  Hủy
                </Button>
                <Button onClick={handleComplete} data-testid="confirm-complete-button">
                  Xác nhận hoàn thành
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardFooter>
      )}
    </Card>
  );
};

const ScheduleManager = () => {
  const { API, getAuthHeader, user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  useEffect(() => {
    fetchSchedules();
  }, []);

  const fetchSchedules = async () => {
    try {
      const response = await axios.get(`${API}/doctors/${user.id}/schedules`, getAuthHeader());
      setSchedules(response.data);
    } catch (error) {
      console.error('Error fetching schedules:', error);
    }
  };

  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 8; hour < 17; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const startTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const endHour = minute === 30 ? hour + 1 : hour;
        const endMinute = minute === 30 ? '00' : '30';
        const endTime = `${endHour.toString().padStart(2, '0')}:${endMinute}`;
        slots.push({ start_time: startTime, end_time: endTime, is_available: true });
      }
    }
    return slots;
  };

  const handleCreateSchedule = async () => {
    if (!selectedDate) {
      toast.error('Vui lòng chọn ngày');
      return;
    }

    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      await axios.post(
        `${API}/doctors/schedule`,
        {
          date: dateStr,
          time_slots: generateTimeSlots()
        },
        getAuthHeader()
      );
      toast.success('Tạo lịch làm việc thành công!');
      setShowCreateDialog(false);
      setSelectedDate(null);
      fetchSchedules();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Không thể tạo lịch làm việc');
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Lịch Làm Việc</CardTitle>
              <CardDescription>Quản lý lịch làm việc của bạn</CardDescription>
            </div>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button data-testid="add-schedule-button">
                  <Plus className="h-4 w-4 mr-2" />
                  Thêm Lịch
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Tạo Lịch Làm Việc Mới</DialogTitle>
                  <DialogDescription>
                    Chọn ngày làm việc (8:00 - 17:00, mỗi slot 30 phút)
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start" data-testid="schedule-date-picker">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedDate ? format(selectedDate, 'PPP', { locale: vi }) : 'Chọn ngày'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Lịch làm việc sẽ được tạo từ 8:00 đến 17:00 với các slot 30 phút
                    </AlertDescription>
                  </Alert>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Hủy
                  </Button>
                  <Button onClick={handleCreateSchedule} data-testid="confirm-schedule-button">
                    Tạo lịch
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {schedules.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Clock className="h-12 w-12 mx-auto mb-3 text-gray-400" />
              <p>Chưa có lịch làm việc nào</p>
            </div>
          ) : (
            <div className="space-y-2">
              {schedules.map((schedule) => (
                <div
                  key={schedule.id}
                  className="flex justify-between items-center p-3 border rounded-lg"
                  data-testid="schedule-item"
                >
                  <div className="flex items-center">
                    <CalendarIcon className="h-5 w-5 text-blue-600 mr-3" />
                    <div>
                      <p className="font-medium">{schedule.date}</p>
                      <p className="text-sm text-gray-500">
                        {schedule.time_slots.length} slot khả dụng
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline">{schedule.time_slots.filter(s => s.is_available).length} trống</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DoctorDashboard;
