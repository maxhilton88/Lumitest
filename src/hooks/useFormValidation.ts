import { useState, useEffect } from 'react';

type ValidationRule = {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: string) => boolean;
  message?: string;
};

type ValidationRules = {
  [key: string]: ValidationRule;
};

type FormErrors = {
  [key: string]: string;
};

export const useFormValidation = (initialValues: any, validationRules: ValidationRules) => {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<{ [key: string]: boolean }>({});
  const [isValid, setIsValid] = useState(false);

  // Validate single field
  const validateField = (name: string, value: string): string => {
    const rules = validationRules[name];
    if (!rules) return '';

    // Required validation
    if (rules.required && !value.trim()) {
      return rules.message || 'This field is required';
    }

    // Min length validation
    if (rules.minLength && value.length < rules.minLength) {
      return rules.message || `Minimum ${rules.minLength} characters required`;
    }

    // Max length validation
    if (rules.maxLength && value.length > rules.maxLength) {
      return rules.message || `Maximum ${rules.maxLength} characters allowed`;
    }

    // Pattern validation (email, phone, etc.)
    if (rules.pattern && !rules.pattern.test(value)) {
      return rules.message || 'Invalid format';
    }

    // Custom validation
    if (rules.custom && !rules.custom(value)) {
      return rules.message || 'Invalid value';
    }

    return '';
  };

  // Validate all fields
  const validateForm = () => {
    const newErrors: FormErrors = {};
    let formIsValid = true;

    Object.keys(validationRules).forEach(field => {
      const error = validateField(field, values[field] || '');
      if (error) {
        newErrors[field] = error;
        formIsValid = false;
      }
    });

    setErrors(newErrors);
    setIsValid(formIsValid);
    return formIsValid;
  };

  // Handle field change
  const handleChange = (name: string, value: string) => {
    setValues((prev: any) => ({ ...prev, [name]: value }));
    
    // Validate on change if field has been touched
    if (touched[name]) {
      const error = validateField(name, value);
      setErrors((prev) => ({ ...prev, [name]: error }));
    }
  };

  // Handle field blur
  const handleBlur = (name: string) => {
    setTouched((prev) => ({ ...prev, [name]: true }));
    const error = validateField(name, values[name] || '');
    setErrors((prev) => ({ ...prev, [name]: error }));
  };

  // Reset form
  const resetForm = () => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
    setIsValid(false);
  };

  // Check if form is valid whenever values change
  useEffect(() => {
    const allTouched = Object.keys(validationRules).every(field => touched[field]);
    if (allTouched) {
      validateForm();
    }
  }, [values]);

  return {
    values,
    errors,
    touched,
    isValid,
    handleChange,
    handleBlur,
    validateForm,
    resetForm,
    setValues
  };
};

// Common validation patterns
export const VALIDATION_PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^\+?[0-9]{10,15}$/,
  whatsapp: /^\+?[0-9]{10,15}$/,
  url: /^https?:\/\/.+/
};
