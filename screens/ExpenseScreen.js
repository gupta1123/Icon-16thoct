
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Calendar } from 'react-native-calendars';

const ExpenseDateSelector = ({ expenseDate, onDateChange }) => {
  const [isCalendarVisible, setCalendarVisible] = useState(false);
  const [tempDate, setTempDate] = useState(expenseDate);
  const today = new Date().toISOString().split('T')[0];
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  const minDate = twoDaysAgo.toISOString().split('T')[0];

  const applyDate = () => {
    const d = tempDate || today;
    onDateChange?.(d);
    setCalendarVisible(false);
  };

  const formatted = new Date(expenseDate).toLocaleDateString();

  return (
    <View style={styles.dateRangeSelectorContainer}>
      <TouchableOpacity style={styles.dateRangeButton} onPress={() => setCalendarVisible(true)}>
        <Ionicons name="calendar-outline" size={24} color="#2563EB" />
        <Text style={styles.dateRangeText}>{formatted}</Text>
      </TouchableOpacity>

      <Modal visible={isCalendarVisible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.calendarContainer}>
            <Calendar
              current={tempDate || today}
              maxDate={today}
              minDate={minDate}
              onDayPress={(day) => setTempDate(day.dateString)}
              markedDates={{
                [(tempDate || today)]: { selected: true, selectedColor: '#2563EB' },
              }}
            />
            <View style={styles.buttonContainer}>
              <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={() => setCalendarVisible(false)}>
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, styles.applyButton]} onPress={applyDate}>
                <Text style={styles.applyButtonText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const ExpenseTracker = () => {
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  const [isMonthSheetOpen, setIsMonthSheetOpen] = useState(false);
  const [isYearSheetOpen, setIsYearSheetOpen] = useState(false);
  const [isExpenseTypeSheetOpen, setIsExpenseTypeSheetOpen] = useState(false);
  const [expenseType, setExpenseType] = useState('food');
  const [travelSubType, setTravelSubType] = useState('bike');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [expenses, setExpenses] = useState([]);
  const [filteredExpenses, setFilteredExpenses] = useState([]);
  const [authToken, setAuthToken] = useState(null);
  const [employeeId, setEmployeeId] = useState(null);
  const currentDate = new Date();
  const currentMonth = currentDate.toLocaleString('default', { month: 'long' });
  const currentYear = currentDate.getFullYear().toString();
  const navigation = useNavigation();

  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const years = ['2021', '2022', '2023', '2024', '2025'];
  const expenseTypes = ['food', 'travel', 'accommodation', 'other'];

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        const id = await AsyncStorage.getItem('employeeId');
        setAuthToken(token);
        setEmployeeId(id);
        if (token && id) {
          fetchExpenses(token, id);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (expenses.length) {
      filterExpenses(expenses, selectedMonth, selectedYear);
    }
  }, [selectedMonth, selectedYear]);

  const fetchExpenses = async (token, id) => {
    try {
      const response = await axios.get(`https://unbalkingly-uncharged-elizabet.ngrok-free.dev/expense/getById?id=${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'ngrok-skip-browser-warning': 'true',
          'User-Agent': 'IconMobile',
        },
      });
      const data = response.data;
      setExpenses(data);
      filterExpenses(data, selectedMonth, selectedYear);
    } catch (error) {
      console.error('Error fetching expenses:', error);
    }
  };

  const filterExpenses = (expenses, month, year) => {
    const filtered = expenses.filter((expense) => {
      const expenseDate = new Date(expense.expenseDate);
      return expenseDate.getMonth() === months.indexOf(month) && expenseDate.getFullYear() === parseInt(year);
    });
    setFilteredExpenses(filtered);
  };

  const handleAddExpense = () => {
    setIsBottomSheetOpen(true);
  };

  const handleMonthSelect = (month) => {
    setSelectedMonth(month);
    setIsMonthSheetOpen(false);
  };

  const handleYearSelect = (year) => {
    setSelectedYear(year);
    setIsYearSheetOpen(false);
  };

  const handleExpenseTypeSelect = (type) => {
    setExpenseType(type);
    setIsExpenseTypeSheetOpen(false);
    if (type === 'travel') {
      setTravelSubType('bike');
    }
  };

  const handleSubmitExpense = async () => {
    try {
      // Validate required fields
      if (!amount || amount.trim() === '' || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        Alert.alert('Validation Error', 'Please enter a valid amount.');
        return;
      }

      if (!description || description.trim() === '') {
        Alert.alert('Validation Error', 'Please enter a description.');
        return;
      }

      if (!employeeId) {
        Alert.alert('Error', 'Employee ID not found. Please log in again.');
        return;
      }

      // Validate date - allow up to 2 days in the past, no future dates
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const selectedDate = new Date(expenseDate);
      selectedDate.setHours(0, 0, 0, 0);
      const twoDaysAgo = new Date(today);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      if (selectedDate > today) {
        Alert.alert('Invalid Date', 'Cannot add expenses for future dates.');
        return;
      }

      if (selectedDate < twoDaysAgo) {
        Alert.alert('Invalid Date', 'Can only add expenses for today or up to 2 days in the past.');
        return;
      }

      const newExpense = {
        type: expenseType,
        subType: expenseType === 'travel' ? travelSubType : null,
        amount: parseFloat(amount),
        description,
        employeeId: parseInt(employeeId), // Convert to integer
        expenseDate: expenseDate,
      };

      console.log('🔵 [EXPENSE] Creating expense with payload:', JSON.stringify(newExpense, null, 2));
      console.log('🔵 [EXPENSE] Employee ID:', employeeId, 'Type:', typeof employeeId);
      console.log('🔵 [EXPENSE] Expense Date:', expenseDate);

      const response = await axios.post('https://unbalkingly-uncharged-elizabet.ngrok-free.dev/expense/create', newExpense, {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'ngrok-skip-browser-warning': 'true',
          'User-Agent': 'IconMobile',
        },
      });

      console.log('✅ [EXPENSE] Expense created successfully:', response.data);

      if (response.data) {
        setIsBottomSheetOpen(false);
        fetchExpenses(authToken, employeeId); // Fetch updated expenses after adding a new one
        setExpenseType('food');
        setAmount('');
        setDescription('');
        setExpenseDate(new Date().toISOString().split('T')[0]); // Reset to today
      }
    } catch (error) {
      console.error('❌ [EXPENSE] Error creating expense:', error);
      console.error('❌ [EXPENSE] Error response:', error.response?.data);
      console.error('❌ [EXPENSE] Error status:', error.response?.status);
      Alert.alert('Error', error.response?.data?.message || 'Failed to add expense. Please try again.');
    }
  };

  const goBack = () => {
    navigation.goBack();
  };

  const renderBottomSheet = (data, onSelect, isVisible, onClose, title) => (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackground}>
        <View style={styles.bottomSheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetHeaderText}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={data}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.bottomSheetItem} onPress={() => onSelect(item)}>
                <Text style={styles.bottomSheetItemText}>{item}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <View style={styles.filtersContainer}>
        <TouchableOpacity style={styles.backButton} onPress={goBack}>
          <Ionicons name="chevron-back" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.filters}>
          <TouchableOpacity style={styles.monthFilter} onPress={() => setIsMonthSheetOpen(true)}>
            <Ionicons name="calendar-outline" size={20} color="#2563EB" />
            <Text style={styles.filterText}>{selectedMonth}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.yearFilter} onPress={() => setIsYearSheetOpen(true)}>
            <Ionicons name="calendar" size={20} color="#2563EB" />
            <Text style={styles.filterText}>{selectedYear}</Text>
          </TouchableOpacity>
        </View>
      </View>
      <ExpenseDateSelector
        expenseDate={expenseDate}
        onDateChange={setExpenseDate}
      />
      <TouchableOpacity style={styles.addExpenseButton} onPress={handleAddExpense}>
        <Ionicons name="add" size={20} color="#fff" />
        <Text style={styles.addExpenseButtonText}>Add Expense</Text>
      </TouchableOpacity>
      <ScrollView style={styles.expenseList}>
        {filteredExpenses.map((expense) => (
          <View key={expense.id} style={styles.expenseCard}>
            <View style={styles.cardHeader}>
              <View style={styles.dateTime}>
                <Text style={styles.date}>{expense.expenseDate}</Text>
              </View>
              <View style={styles.expenseType}>
                <Ionicons
                  name={
                    expense.type === 'food'
                      ? 'fast-food-outline'
                      : expense.type === 'travel'
                        ? 'airplane-outline'
                        : expense.type === 'accommodation'
                          ? 'bed-outline'
                          : 'cash-outline'
                  }
                  size={20}
                  color="#2563EB"
                />
                <Text style={styles.expenseTypeText}>{expense.type}</Text>
              </View>
            </View>
            <View style={styles.cardBody}>
              <View style={styles.amountContainer}>
                <Text style={styles.amount}>₹{expense.amount}</Text>
                <View style={styles.status}>
                  <Text
                    style={[
                      styles.statusLabel,
                      expense.approvalStatus?.toUpperCase() === 'APPROVED'
                        ? styles.approvedStatus
                        : expense.approvalStatus?.toUpperCase() === 'PENDING'
                          ? styles.pendingStatus
                          : styles.rejectedStatus,
                    ]}
                  >
                    {expense.approvalStatus?.toUpperCase()}
                  </Text>
                </View>
              </View>
              <View style={styles.description}>
                <Ionicons name="chatbubble-outline" size={20} color="#2563EB" />
                <Text style={styles.descriptionText}>{expense.description}</Text>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
      <Modal
        visible={isBottomSheetOpen}
        animationType="slide"
        onRequestClose={() => setIsBottomSheetOpen(false)}
        transparent={true}
      >
        <View style={styles.modalBackground}>
          <View style={styles.bottomSheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetHeaderText}>Add Expense</Text>
              <TouchableOpacity onPress={() => setIsBottomSheetOpen(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.sheetBody}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Expense Type</Text>
                <TouchableOpacity
                  style={styles.expenseTypeSelect}
                  onPress={() => setIsExpenseTypeSheetOpen(true)}
                >
                  <Text style={styles.input}>{expenseType}</Text>
                  <Ionicons name="chevron-down" size={20} color="#2563EB" />
                </TouchableOpacity>
              </View>
              {expenseType === 'travel' && (
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Travel Subtype</Text>
                  <View style={[styles.expenseTypeSelect, styles.travelSubtypeDisplay]}>
                    <Text style={styles.input}>{travelSubType}</Text>
                  </View>
                </View>
              )}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Amount</Text>
                <View style={styles.amountInput}>
                  <Text style={styles.currency}>₹</Text>
                  <TextInput
                    style={styles.input}
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="numeric"
                    placeholder="0.00"
                  />
                </View>
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={[styles.input, styles.descriptionInput]}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  placeholder="Enter description"
                />
              </View>
            </ScrollView>
            <TouchableOpacity style={styles.submitButton} onPress={handleSubmitExpense}>
              <Text style={styles.submitButtonText}>Add Expense</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {renderBottomSheet(months, handleMonthSelect, isMonthSheetOpen, () => setIsMonthSheetOpen(false), 'Select Month')}
      {renderBottomSheet(years, handleYearSelect, isYearSheetOpen, () => setIsYearSheetOpen(false), 'Select Year')}
      {renderBottomSheet(expenseTypes, handleExpenseTypeSelect, isExpenseTypeSheetOpen, () => setIsExpenseTypeSheetOpen(false), 'Select Expense Type')}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  filtersContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    marginRight: 10,
  },
  filters: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  monthFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f2f2f2',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  yearFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f2f2f2',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginLeft: 'auto',
  },
  filterText: {
    fontSize: 16,
    marginLeft: 8,
  },
  addExpenseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  addExpenseButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 8,
  },
  expenseList: {
    flex: 1,
  },
  expenseCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    marginBottom: 16,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  dateTime: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  date: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  time: {
    fontSize: 14,
    color: '#666',
  },
  expenseType: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expenseTypeText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 4,
  },
  cardBody: {
    marginTop: 16,
  },
  amountContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  amount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2563EB',
  },
  status: {
    backgroundColor: '#E0F7EA',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  approvedStatus: {
    color: '#2E7D32',
  },
  pendingStatus: {
    color: '#FF8F00',
  },
  rejectedStatus: {
    color: '#D32F2F',
  },
  description: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  descriptionText: {
    fontSize: 16,
    color: '#555',
    marginLeft: 8,
  },
  bottomSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    maxHeight: '80%',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f2f2f2',
    backgroundColor: '#2563EB',
  },
  sheetHeaderText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  sheetBody: {
    padding: 24,
  },
  formGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  expenseTypeSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f2f2f2',
    borderRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  input: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  amountInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f2f2f2',
    borderRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  currency: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginRight: 8,
  },
  descriptionInput: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  submitButton: {
    backgroundColor: '#2563EB',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 20, // Ensure there is space at the bottom
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  dateRangeSelectorContainer: {
    marginBottom: 16,
  },
  dateRangeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f2f2f2',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  dateRangeText: {
    fontSize: 16,
    marginLeft: 8,
    color: '#333',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  calendarContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    width: '90%',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f2f2f2',
  },
  applyButton: {
    backgroundColor: '#2563EB',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheetItem: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    alignItems: 'center',
  },
  bottomSheetItemText: {
    fontSize: 18,
  },
});

export default ExpenseTracker;

