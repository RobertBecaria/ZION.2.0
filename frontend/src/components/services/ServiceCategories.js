/**
 * ServiceCategories Component
 * Displays service categories grid for selection
 */
import React from 'react';
import { 
  Sparkles, Stethoscope, UtensilsCrossed, Car, Home, 
  GraduationCap, Briefcase, PartyPopper, PawPrint, MoreHorizontal 
} from 'lucide-react';

const CATEGORY_ICONS = {
  beauty: Sparkles,
  medical: Stethoscope,
  food: UtensilsCrossed,
  auto: Car,
  home: Home,
  education: GraduationCap,
  professional: Briefcase,
  events: PartyPopper,
  pets: PawPrint,
  other: MoreHorizontal
};

const ServiceCategories = ({ 
  categories, 
  selectedCategory, 
  onCategorySelect,
  moduleColor = '#B91C1C'
}) => {
  const categoryEntries = Object.entries(categories || {});

  return (
    <div className="service-categories">
      <h3 className="categories-title" style={{ color: moduleColor }}>
        Категории услуг
      </h3>
      <div className="categories-grid">
        {categoryEntries.map(([id, category]) => {
          const IconComponent = CATEGORY_ICONS[id] || MoreHorizontal;
          const isSelected = selectedCategory === id;
          
          return (
            <div
              key={id}
              className={`category-card ${isSelected ? 'selected' : ''}`}
              onClick={() => onCategorySelect(isSelected ? null : id)}
              style={{
                borderColor: isSelected ? moduleColor : 'transparent',
                backgroundColor: isSelected ? `${moduleColor}10` : undefined
              }}
            >
              <div 
                className="category-icon"
                style={{ backgroundColor: `${moduleColor}15`, color: moduleColor }}
              >
                <IconComponent size={24} />
              </div>
              <div className="category-info">
                <h4>{category.name}</h4>
                <span className="subcategory-count">
                  {category.subcategories?.length || 0} подкатегорий
                </span>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Subcategories when category is selected */}
      {selectedCategory && categories[selectedCategory] && (
        <div className="subcategories-section">
          <h4>Подкатегории</h4>
          <div className="subcategories-list">
            {categories[selectedCategory].subcategories.map(sub => (
              <button
                key={sub.id}
                className="subcategory-chip"
                style={{ 
                  backgroundColor: `${moduleColor}15`,
                  color: moduleColor,
                  borderColor: `${moduleColor}30`
                }}
              >
                {sub.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceCategories;
