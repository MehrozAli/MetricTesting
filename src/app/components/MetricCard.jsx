"use client";

export default function MetricCard({ metric }) {
  const {
    title,
    description,
    calculations,
    recordedBy,
    sources,
    id,
    aliases,
    importance,
  } = metric;
  console.log({ metric });

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:shadow-md dark:shadow-gray-900/20 dark:hover:shadow-gray-900/30 transition-shadow duration-200 p-6">
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          {title}
        </h3>
      </div>

      {/* Definition */}
      {description && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Definition
          </h4>
          <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
            {description}
          </p>
        </div>
      )}

      {/* Calculation */}
      {calculations && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Calculation
          </h4>
          <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
            {calculations}
          </p>
        </div>
      )}

      {/* Recorded By */}
      {recordedBy && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Recorded By
          </h4>
          <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
            {recordedBy}
          </p>
        </div>
      )}

      {/* They Come Through */}
      {sources && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Sources
          </h4>
          <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
            {sources}
          </p>
        </div>
      )}

      {/* Additional Info */}
      {importance && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Importance
          </h4>
          <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
            {importance}
          </p>
        </div>
      )}
    </div>
  );
}
