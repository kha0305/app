import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Calendar as CalendarIcon, Search, Clock, User, Phone, Mail, Stethoscope, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';

const PatientDashboard = () => {
  const { API, getAuthHeader } = useAuth();
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [selectedSpecialty, setSelectedSpecialty] = useState('all');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSpecialties();
    fetchDoctors();
    fetchAppointments();
  }, []);

  const fetchSpecialties = async () => {
    try {
      const response = await axios.get(`${API}/specialties`);
      setSpecialties(response.data.specialties);
    } catch (error) {
      console.error('Error fetching specialties:', error);
    }
  };

  const fetchDoctors = async (specialty = null) => {
    try {
      const url = specialty && specialty !== 'all' 
        ? `${API}/doctors?specialty=${encodeURIComponent(specialty)}`
        : `${API}/doctors`;
      const response = await axios.get(url);
      setDoctors(response.data);
    } catch (error) {
      console.error('Error fetching doctors:', error);
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

  const handleSpecialtyChange = (value) => {
    setSelectedSpecialty(value);
    fetchDoctors(value === 'all' ? null : value);
  };

  const cancelAppointment = async (appointmentId) => {
    if (!window.confirm('Bạn có chắc chắn muốn hủy lịch hẹn này?')) return;
    
    try {
      await axios.delete(`${API}/appointments/${appointmentId}`, getAuthHeader());
      toast.success('Hủy lịch hẹn thành công!');
      fetchAppointments();
    } catch (error) {
      toast.error('Không thể hủy lịch hẹn');
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

  return (
    <div className="max-w-7xl mx-auto p-6" data-testid="patient-dashboard">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Bảng Điều Khiển Bệnh Nhân</h1>
        <p className="text-gray-600">Tìm bác sĩ và quản lý lịch hẹn của bạn</p>
      </div>

      <Tabs defaultValue="find-doctor" className="space-y-4">
        <TabsList>
          <TabsTrigger value="find-doctor" data-testid="find-doctor-tab">
            <Search className="h-4 w-4 mr-2" />
            Tìm Bác Sĩ
          </TabsTrigger>
          <TabsTrigger value="my-appointments" data-testid="my-appointments-tab">
            <CalendarIcon className="h-4 w-4 mr-2" />
            Lịch Hẹn Của Tôi
          </TabsTrigger>
        </TabsList>

        <TabsContent value="find-doctor" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tìm kiếm bác sĩ</CardTitle>
              <CardDescription>Lọc theo chuyên khoa</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedSpecialty} onValueChange={handleSpecialtyChange}>
                <SelectTrigger data-testid="specialty-filter">
                  <SelectValue placeholder="Chọn chuyên khoa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả chuyên khoa</SelectItem>
                  {specialties.map((specialty) => (
                    <SelectItem key={specialty} value={specialty}>{specialty}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {doctors.map((doctor) => (
              <DoctorCard key={doctor.id} doctor={doctor} onBookSuccess={fetchAppointments} />
            ))}
            {doctors.length === 0 && (
              <div className="col-span-2 text-center py-12">
                <Stethoscope className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500">Không tìm thấy bác sĩ</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="my-appointments" className="space-y-4">
          {appointments.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <CalendarIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500">Bạn chưa có lịch hẹn nào</p>
              </CardContent>
            </Card>
          ) : (
            appointments.map((appointment) => (
              <Card key={appointment.id} data-testid="appointment-card">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{appointment.doctor_name}</CardTitle>
                      <CardDescription>{appointment.doctor_specialty}</CardDescription>
                    </div>
                    {getStatusBadge(appointment.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center text-sm text-gray-600">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    <span>{appointment.appointment_date}</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <Clock className="h-4 w-4 mr-2" />
                    <span>{appointment.appointment_time}</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <Phone className="h-4 w-4 mr-2" />
                    <span>{appointment.doctor_phone}</span>
                  </div>
                  {appointment.reason && (
                    <div className="pt-2 border-t">
                      <p className="text-sm font-medium text-gray-700">Lý do khám:</p>
                      <p className="text-sm text-gray-600">{appointment.reason}</p>
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
                  <CardFooter>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => cancelAppointment(appointment.id)}
                      data-testid="cancel-appointment-button"
                    >
                      Hủy lịch hẹn
                    </Button>
                  </CardFooter>
                )}
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

const DoctorCard = ({ doctor, onBookSuccess }) => {
  const { API, getAuthHeader } = useAuth();
  const [open, setOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchAvailableSlots = async (date) => {
    if (!date) return;
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      const response = await axios.get(`${API}/doctors/${doctor.user_id}/available-slots?date=${dateStr}`);
      setAvailableSlots(response.data.slots || []);
    } catch (error) {
      console.error('Error fetching slots:', error);
      setAvailableSlots([]);
    }
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    setSelectedSlot(null);
    fetchAvailableSlots(date);
  };

  const handleBookAppointment = async () => {
    if (!selectedDate || !selectedSlot || !reason) {
      toast.error('Vui lòng điền đầy đủ thông tin');
      return;
    }

    setLoading(true);
    try {
      await axios.post(
        `${API}/appointments`,
        {
          doctor_id: doctor.user_id,
          appointment_date: format(selectedDate, 'yyyy-MM-dd'),
          appointment_time: selectedSlot,
          reason,
          notes: notes || null
        },
        getAuthHeader()
      );
      toast.success('Đặt lịch hẹn thành công!');
      setOpen(false);
      onBookSuccess();
      // Reset form
      setSelectedDate(null);
      setSelectedSlot(null);
      setReason('');
      setNotes('');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Không thể đặt lịch hẹn');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card data-testid="doctor-card">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>{doctor.full_name}</CardTitle>
            <CardDescription>{doctor.specialty}</CardDescription>
          </div>
          <Badge variant="outline" className="font-mono">{doctor.doctor_code}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center text-sm text-gray-600">
          <User className="h-4 w-4 mr-2" />
          <span>{doctor.experience_years} năm kinh nghiệm</span>
        </div>
        <p className="text-sm text-gray-600 line-clamp-2">{doctor.description}</p>
        <div className="pt-2">
          <p className="text-lg font-semibold text-blue-600">
            {doctor.consultation_fee.toLocaleString('vi-VN')} VNĐ
          </p>
        </div>
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button 
          variant="outline" 
          className="flex-1" 
          onClick={() => setDetailsOpen(true)}
          data-testid="view-details-button"
        >
          Xem Chi Tiết
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="flex-1" data-testid="book-appointment-button">Đặt Lịch Khám</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Đặt lịch khám với {doctor.full_name}</DialogTitle>
              <DialogDescription>{doctor.specialty}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Chọn ngày khám</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left" data-testid="date-picker-button">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate ? format(selectedDate, 'PPP', { locale: vi }) : 'Chọn ngày'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={handleDateSelect}
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {selectedDate && (
                <div>
                  <Label>Chọn giờ khám</Label>
                  {availableSlots.length === 0 ? (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Không có lịch trống cho ngày này
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <div className="grid grid-cols-4 gap-2 mt-2">
                      {availableSlots.map((slot) => (
                        <Button
                          key={slot.start_time}
                          variant={selectedSlot === slot.start_time ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSelectedSlot(slot.start_time)}
                          data-testid="time-slot-button"
                        >
                          {slot.start_time}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div>
                <Label htmlFor="reason">Lý do khám *</Label>
                <Textarea
                  id="reason"
                  data-testid="reason-input"
                  placeholder="Mô tả triệu chứng hoặc lý do khám bệnh"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="notes">Ghi chú thêm (nếu có)</Label>
                <Textarea
                  id="notes"
                  data-testid="notes-input"
                  placeholder="Thông tin bổ sung"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </div>

              <Button
                onClick={handleBookAppointment}
                disabled={loading || !selectedDate || !selectedSlot || !reason}
                className="w-full"
                data-testid="confirm-booking-button"
              >
                {loading ? 'Đang đặt lịch...' : 'Xác nhận đặt lịch'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{doctor.full_name}</DialogTitle>
              <DialogDescription>{doctor.specialty}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Mã bác sĩ</Label>
                  <p className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">{doctor.doctor_code}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Kinh nghiệm</Label>
                  <p className="text-sm">{doctor.experience_years} năm</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Số điện thoại</Label>
                  <p className="text-sm">{doctor.phone}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Email</Label>
                  <p className="text-sm">{doctor.email}</p>
                </div>
              </div>
              
              <div>
                <Label className="text-sm font-medium text-gray-700">Mô tả</Label>
                <p className="text-sm text-gray-600 leading-relaxed">{doctor.description}</p>
              </div>
              
              <div>
                <Label className="text-sm font-medium text-gray-700">Phí tư vấn</Label>
                <p className="text-lg font-semibold text-blue-600">
                  {doctor.consultation_fee.toLocaleString('vi-VN')} VNĐ
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardFooter>
    </Card>
  );
};

export default PatientDashboard;