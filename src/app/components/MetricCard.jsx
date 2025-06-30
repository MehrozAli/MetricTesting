"use client";

export default function MetricCard({ metric }) {
  const {
    business_name,
    definition,
    calculation,
    m_recorded_by,
    m_they_come_through,
    uid,
    aliases,
    importance,
  } = metric;

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 p-6">
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          {business_name}
        </h3>
      </div>

      {/* Definition */}
      {definition && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Definition</h4>
          <p className="text-gray-600 text-sm leading-relaxed">{definition}</p>
        </div>
      )}

      {/* Calculation */}
      {calculation && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            Calculation
          </h4>
          <p className="text-gray-600 text-sm leading-relaxed">{calculation}</p>
        </div>
      )}

      {/* Recorded By */}
      {m_recorded_by && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            Recorded By
          </h4>
          <p className="text-gray-600 text-sm leading-relaxed">
            {m_recorded_by}
          </p>
        </div>
      )}

      {/* They Come Through */}
      {m_they_come_through && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Sources</h4>
          <p className="text-gray-600 text-sm leading-relaxed">
            {m_they_come_through}
          </p>
        </div>
      )}

      {/* Additional Info */}
      {importance && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Importance</h4>
          <p className="text-gray-600 text-sm leading-relaxed">{importance}</p>
        </div>
      )}
    </div>
  );
}
